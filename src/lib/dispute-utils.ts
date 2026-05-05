export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'urgent': return 'text-red-500 bg-red-500/10';
    case 'high': return 'text-orange-500 bg-orange-500/10';
    case 'medium': return 'text-yellow-500 bg-yellow-500/10';
    case 'low': return 'text-green-500 bg-green-500/10';
    default: return 'text-muted-foreground bg-muted';
  }
}
