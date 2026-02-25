const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class LXCManager {
  constructor() {
    // LXD uses the 'lxc' command line tool as its client
    this.cmd = 'lxc';
  }

  async createContainer(name, os, osVersion, cpu, ram, disk, features = {}) {
    const distro = this.getDistro(os, osVersion);
    // LXD image format: images:distro/release/arch
    const image = `images:${distro.dist}/${distro.release}`;

    console.log(`[LXD] Creating container ${name} from ${image}`);

    try {
      // 1. Initialize container (creates it but doesn't start it yet)
      await execAsync(`${this.cmd} init ${image} ${name}`);

      // 2. Set resource limits
      await execAsync(`${this.cmd} config set ${name} limits.cpu ${cpu}`);
      await execAsync(`${this.cmd} config set ${name} limits.memory ${ram}MB`);

      // 3. Setup Disk (Attempts to set root disk size)
      try {
        // This requires the container to be using a storage pool that supports resizing
        await execAsync(`${this.cmd} config device set ${name} root size ${disk}GB`);
      } catch (e) {
        console.warn(`[LXD] Disk size setting skipped or failed: ${e.message}`);
      }

      // 4. Set Features/Security
      if (features.nesting) {
        await execAsync(`${this.cmd} config set ${name} security.nesting true`);
      }

      if (features.docker) {
        await execAsync(`${this.cmd} config set ${name} security.nesting true`);
        await execAsync(`${this.cmd} config set ${name} security.privileged true`);
      }

      // 5. Start the container
      await this.startContainer(name);

      return { success: true };
    } catch (err) {
      console.error(`[LXD] Create failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  getDistro(os, version) {
    // Map human friendly names to LXD periodic image names
    const distros = {
      ubuntu: { dist: 'ubuntu', release: version || '22.04' },
      debian: { dist: 'debian', release: (version === 'bookworm' ? '12' : version) || '12' },
      centos: { dist: 'centos', release: version || '9-Stream' },
      alpine: { dist: 'alpine', release: version || '3.18' },
      fedora: { dist: 'fedora', release: version || '38' }
    };
    return distros[os] || distros.ubuntu;
  }

  async startContainer(name) {
    console.log(`[LXD] Starting container: ${name}`);
    try {
      await execAsync(`${this.cmd} start ${name}`);
      return { success: true };
    } catch (err) {
      console.error(`[LXD] Start failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async stopContainer(name) {
    console.log(`[LXD] Stopping container: ${name}`);
    try {
      await execAsync(`${this.cmd} stop ${name}`);
      return { success: true };
    } catch (err) {
      console.error(`[LXD] Stop failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async restartContainer(name) {
    console.log(`[LXD] Restarting container: ${name}`);
    try {
      await execAsync(`${this.cmd} restart ${name}`);
      return { success: true };
    } catch (err) {
      console.error(`[LXD] Restart failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async destroyContainer(name) {
    console.log(`[LXD] Destroying container: ${name}`);
    try {
      // Force delete even if running
      await execAsync(`${this.cmd} delete ${name} --force`);
      return { success: true };
    } catch (err) {
      console.error(`[LXD] Destroy failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async getContainerIP(name) {
    try {
      // LXD list output in JSON format is the most reliable way to get IP
      const { stdout } = await execAsync(`${this.cmd} list ${name} --format json`);
      const data = JSON.parse(stdout);
      if (data && data[0] && data[0].state && data[0].state.network) {
        // Look for the first IPv4 address on eth0 or any interface
        for (const [iface, details] of Object.entries(data[0].state.network)) {
          if (details.addresses) {
            const ipv4 = details.addresses.find(a => a.family === 'inet' && a.scope === 'global');
            if (ipv4) return ipv4.address;
          }
        }
      }
      return null;
    } catch (err) {
      console.error(`[LXD] Failed to get IP for ${name}:`, err.message);
      return null;
    }
  }

  async executeCommand(name, command) {
    try {
      // exec command in LXD: lxc exec <name> -- <command>
      const { stdout, stderr } = await execAsync(`${this.cmd} exec ${name} -- bash -c "${command}"`);
      return { success: true, output: stdout, error: stderr };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async setRootPassword(name, password) {
    // Classic way to set password in container
    return this.executeCommand(name, `echo "root:${password}" | chpasswd`);
  }

  async getStats(name) {
    try {
      const { stdout } = await execAsync(`${this.cmd} list ${name} --format json`);
      const data = JSON.parse(stdout);
      if (data && data[0] && data[0].state) {
        return {
          success: true,
          cpu: data[0].state.cpu.usage,
          memory: data[0].state.memory.usage
        };
      }
      return { success: false };
    } catch (err) {
      return { success: false };
    }
  }
}

module.exports = new LXCManager();
