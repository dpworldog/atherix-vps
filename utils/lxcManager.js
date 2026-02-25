const { exec, execSync } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class LXCManager {
  constructor() {
    this.defaultConfig = {
      storage: process.env.LXC_STORAGE || 'default',
      bridge: process.env.LXC_BRIDGE || 'lxcbr0',
      gateway: process.env.LXC_GATEWAY || '10.0.3.1',
      dns: process.env.LXC_DNS || '8.8.8.8',
    };
  }

  // Get next available LXC ID
  async getNextId() {
    try {
      const { stdout } = await execAsync('lxc-ls | tr " " "\n" | grep -E "^[0-9]+$" | sort -n | tail -1');
      const lastId = parseInt(stdout.trim()) || 100;
      return lastId + 1;
    } catch {
      return 101;
    }
  }

  // Generate LXC config content
  generateConfig(options) {
    const { name, cpu, ram, disk, bridge, ipv4, gateway, dns, features } = options;
    
    let config = `# AtherixCloud LXC Container: ${name}
lxc.utsname = ${name}
lxc.arch = amd64

# Network
lxc.network.type = veth
lxc.network.flags = up
lxc.network.link = ${bridge || this.defaultConfig.bridge}
lxc.network.name = eth0
`;

    if (ipv4) {
      config += `lxc.network.ipv4 = ${ipv4}/24
lxc.network.ipv4.gateway = ${gateway || this.defaultConfig.gateway}
`;
    }

    config += `
# Resources
lxc.cgroup.cpu.shares = ${cpu * 1024}
lxc.cgroup.cpu.cfs_quota_us = ${cpu * 100000}
lxc.cgroup.memory.limit_in_bytes = ${ram}M
lxc.cgroup.memory.memsw.limit_in_bytes = ${ram * 2}M

# Filesystem
lxc.rootfs.path = /var/lib/lxc/${name}/rootfs
lxc.rootfs.backend = dir

# Logging
lxc.log.level = warn
lxc.log.file = /var/log/lxc/${name}.log

# Security / Capabilities
lxc.cap.drop = sys_module
lxc.cap.drop = mac_admin
lxc.cap.drop = mac_override
`;

    // Features
    if (features?.nesting) {
      config += `
# Nesting support (for running containers inside)
lxc.aa_profile = lxc-container-default-with-nesting
lxc.cgroup.devices.allow = a
lxc.mount.auto = cgroup:mixed
`;
    }

    if (features?.kvm) {
      config += `
# KVM support
lxc.cgroup.devices.allow = c 10:232 rwm
lxc.cgroup.devices.allow = c 10:200 rwm
`;
    }

    if (features?.fuse) {
      config += `
# FUSE support
lxc.mount.entry = /dev/fuse dev/fuse none bind,create=file 0 0
lxc.cgroup.devices.allow = c 10:229 rwm
`;
    }

    if (features?.docker) {
      config += `
# Docker support (requires nesting + additional caps)
lxc.aa_profile = unconfined
lxc.cgroup.devices.allow = a
lxc.cap.keep = setgid setuid sys_chroot sys_admin net_admin
`;
    }

    return config;
  }

  // Create LXC container
  async createContainer(options) {
    const { name, os, cpu, ram, disk, ipv4, features, rootPassword } = options;
    
    // Parse OS template
    const [distro, version] = (os || 'ubuntu:22.04').split(':');
    
    // Build lxc-create command
    let cmd = `lxc-create -n "${name}" -t download -- -d ${distro} -r ${version} -a amd64 --no-validate`;
    
    try {
      console.log(`[LXC] Creating container: ${name}`);
      const { stdout, stderr } = await execAsync(cmd, { timeout: 120000 });
      console.log('[LXC] Container created:', stdout);

      // Write custom config
      const configContent = this.generateConfig({ name, cpu, ram, disk, bridge: this.defaultConfig.bridge, ipv4, gateway: this.defaultConfig.gateway, dns: this.defaultConfig.dns, features });
      
      const fs = require('fs');
      fs.writeFileSync(`/var/lib/lxc/${name}/config`, configContent);

      // Set root password
      if (rootPassword) {
        await execAsync(`lxc-attach -n "${name}" -- bash -c "echo 'root:${rootPassword}' | chpasswd" 2>/dev/null || true`);
      }

      // Configure disk size
      if (disk) {
        await execAsync(`dd if=/dev/zero of=/var/lib/lxc/${name}/rootfs/swapfile bs=1M count=${Math.min(disk * 100, 1024)} 2>/dev/null || true`);
      }

      return { success: true, name };
    } catch (err) {
      console.error('[LXC] Create error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // Start container
  async startContainer(name) {
    try {
      await execAsync(`lxc-start -n "${name}"`);
      await new Promise(r => setTimeout(r, 2000)); // Wait for startup
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Stop container
  async stopContainer(name) {
    try {
      await execAsync(`lxc-stop -n "${name}" --timeout 30`);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Restart container
  async restartContainer(name) {
    await this.stopContainer(name);
    await new Promise(r => setTimeout(r, 1000));
    return this.startContainer(name);
  }

  // Delete container
  async deleteContainer(name) {
    try {
      await this.stopContainer(name);
      await execAsync(`lxc-destroy -n "${name}" -f`);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Get container info/status
  async getContainerInfo(name) {
    try {
      const { stdout } = await execAsync(`lxc-info -n "${name}" 2>/dev/null`);
      const lines = stdout.split('\n');
      const info = {};
      lines.forEach(line => {
        const [key, val] = line.split(':').map(s => s.trim());
        if (key && val) info[key.toLowerCase()] = val;
      });
      return { success: true, info };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Get container stats (CPU, RAM)
  async getContainerStats(name) {
    try {
      const { stdout: cpuStat } = await execAsync(`cat /sys/fs/cgroup/cpu/lxc/${name}/cpuacct.usage 2>/dev/null || echo 0`);
      const { stdout: memStat } = await execAsync(`cat /sys/fs/cgroup/memory/lxc/${name}/memory.usage_in_bytes 2>/dev/null || echo 0`);
      
      return {
        success: true,
        cpu: parseInt(cpuStat.trim()) || 0,
        memory: parseInt(memStat.trim()) || 0
      };
    } catch {
      return { success: true, cpu: 0, memory: 0 };
    }
  }

  // List all containers
  async listContainers() {
    try {
      const { stdout } = await execAsync(`lxc-ls --fancy 2>/dev/null`);
      return { success: true, output: stdout };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Execute command in container
  async execInContainer(name, command) {
    try {
      const { stdout, stderr } = await execAsync(`lxc-attach -n "${name}" -- bash -c "${command.replace(/"/g, '\\"')}"`, { timeout: 30000 });
      return { success: true, stdout, stderr };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Rebuild/reinstall container
  async rebuildContainer(name, os) {
    await this.deleteContainer(name);
    return this.createContainer({ name, os });
  }

  // Check if LXC is available
  static async checkLXC() {
    try {
      execSync('which lxc-create', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  // Generate random password
  static generatePassword(length = 16) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }
}

module.exports = new LXCManager();
