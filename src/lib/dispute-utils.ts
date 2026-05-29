export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'urgent': return 'text-destructive bg-destructive/10';
    case 'high': return 'text-warning bg-warning/10';
    case 'medium': return 'text-warning bg-warning/10';
    case 'low': return 'text-success bg-success/10';
    default: return 'text-muted-foreground bg-muted';
  }
}
