import * as os from 'os';

function getSystemInfo() {
    switch (os.platform()) {
        case 'win32':
            return 'Windows';
        case 'darwin':
            return 'macOS';
        case 'linux':
            return 'Linux';
        default:
            return `Other OS: ${os.platform()}`;
    }
}

export const SYSTEM = getSystemInfo();