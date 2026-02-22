export interface ComponentStatus {
    lastRun: number;
    lastStatus: 'SUCCESS' | 'FAILURE' | 'PENDING';
    error?: string;
}

class StatusService {
    private components: Map<string, ComponentStatus> = new Map();
    private startTime = Date.now();

    updateStatus(name: string, status: 'SUCCESS' | 'FAILURE' | 'PENDING', error?: string) {
        this.components.set(name, {
            lastRun: Date.now(),
            lastStatus: status,
            error
        });
    }

    getStartTime() {
        return this.startTime;
    }

    getReport() {
        const uptime = Date.now() - this.startTime;
        const uptimeHours = (uptime / (1000 * 60 * 60)).toFixed(1);

        let report = `🏥 *System Status Report*\n`;
        report += `Uptime: ${uptimeHours} hours\n\n`;

        const componentList = Array.from(this.components.entries()).sort((a, b) => a[0].localeCompare(b[0]));

        if (componentList.length === 0) {
            report += "_No components registered yet._";
        } else {
            componentList.forEach(([name, status]) => {
                const icon = status.lastStatus === 'SUCCESS' ? '✅' : status.lastStatus === 'FAILURE' ? '❌' : '⏳';
                const timeStr = new Date(status.lastRun).toLocaleTimeString();
                report += `${icon} *${name}*: ${status.lastStatus} (${timeStr})\n`;
                if (status.error) report += `  └ ⚠️ ${status.error}\n`;
            });
        }

        return report;
    }
}

export const statusService = new StatusService();
