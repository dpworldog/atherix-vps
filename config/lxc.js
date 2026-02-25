const { exec, execSync } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class LXCManager {
  constructor() {
    this.lxcPath = '/usr/bin/lxc-create';
    this.configPath = '/var/lib/lxc';
  }

  async createContainer(name, os, osVersion, cpu, ram, disk, features = {}) {
    const containerConfig = this.generateConfig(cpu, ram, disk, features);
    const distro = this.getDistro(os, osVersion);

    const cmd = `lxc-create -n ${name} -t download -- -d ${distro.dist} -r ${distro.release} -a amd64 --server images.linuxcontainers.org`;
    console.log(`[LXC] Creating container: ${cmd}`);

    try {
      const { stdout, stderr } = await execAsync(cmd, { timeout: 300000 }); // 5 min timeout
      console.log(`[LXC] Create output: ${stdout}`);
      if (stderr) console.warn(`[LXC] Create warning: ${stderr}`);

      await this.applyConfig(name, containerConfig);
      return { success: true, output: stdout };
    } catch (err) {
      console.error(`[LXC] Create failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  generateConfig(cpu, ram, disk, features) {
    let config = `# AtherixCloud VPS Configuration
lxc.cgroup2.cpu.shares = ${cpu * 1024}
lxc.cgroup2.memory.limit_in_bytes = ${ram}M
`;
    if (features.nesting) config += `lxc.include = /usr/share/lxc/config/nesting.conf\n`;
    if (features.kvm) config += `lxc.cgroup2.devices.allow = c 10:232 rwm\nlxc.mount.entry = /dev/kvm dev/kvm none bind,optional,create=file\n`;
    if (features.fuse) config += `lxc.cgroup2.devices.allow = c 10:229 rwm\nlxc.mount.entry = /dev/fuse dev/fuse none bind,optional,create=file\n`;
    if (features.docker) {
      config += `lxc.apparmor.profile = unconfined\nlxc.cgroup2.devices.allow = a\nlxc.cap.drop =\n`;
    }
    return config;
  }

  async applyConfig(name, additionalConfig) {
    const configPath = `${this.configPath}/${name}/config`;
    const appendCmd = `echo '${additionalConfig}' >> ${configPath}`;
    try {
      await execAsync(appendCmd);
    } catch (err) {
      console.error('Config apply error:', err);
    }
  }

  getDistro(os, version) {
    const distros = {
      ubuntu: { dist: 'ubuntu', release: version || '22.04' },
      debian: { dist: 'debian', release: version || 'bookworm' },
      centos: { dist: 'centos', release: version || '9-Stream' },
      alpine: { dist: 'alpine', release: version || '3.18' },
      fedora: { dist: 'fedora', release: version || '38' }
    };
    return distros[os] || distros.ubuntu;
  }

  async startContainer(name) {
    console.log(`[LXC] Starting container: ${name}`);
    try {
      const { stdout, stderr } = await execAsync(`lxc-start -n ${name}`);
      console.log(`[LXC] Start output: ${stdout}`);
      return { success: true };
    } catch (err) {
      console.error(`[LXC] Start failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async stopContainer(name) {
    try {
      await execAsync(`lxc-stop -n ${name}`);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async restartContainer(name) {
    try {
      await execAsync(`lxc-stop -n ${name} && sleep 2 && lxc-start -n ${name}`);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async destroyContainer(name) {
    try {
      await execAsync(`lxc-stop -n ${name} 2>/dev/null; lxc-destroy -n ${name}`);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async getContainerInfo(name) {
    try {
      const { stdout } = await execAsync(`lxc-info -n ${name}`);
      return { success: true, data: stdout };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async getContainerIP(name) {
    try {
      const { stdout } = await execAsync(`lxc-info -n ${name} -iH`);
      return stdout.trim();
    } catch (err) {
      return null;
    }
  }

  async listContainers() {
    try {
      const { stdout } = await execAsync('lxc-ls --fancy --fancy-format name,state,ipv4,pid');
      return { success: true, data: stdout };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async executeCommand(name, command) {
    try {
      const { stdout, stderr } = await execAsync(`lxc-attach -n ${name} -- bash -c "${command}"`);
      return { success: true, output: stdout, error: stderr };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async setRootPassword(name, password) {
    return this.executeCommand(name, `echo "root:${password}" | chpasswd`);
  }

  async getStats(name) {
    try {
      const cpuResult = await execAsync(`lxc-cgroup -n ${name} cpuacct.usage`).catch(() => ({ stdout: '0' }));
      const memResult = await execAsync(`lxc-cgroup -n ${name} memory.usage_in_bytes`).catch(() => ({ stdout: '0' }));
      return {
        success: true,
        cpu: cpuResult.stdout.trim(),
        memory: memResult.stdout.trim()
      };
    } catch (err) {
      return { success: false };
    }
  }
}

module.exports = new LXCManager();
