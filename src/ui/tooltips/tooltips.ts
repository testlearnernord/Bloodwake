export class TooltipManager {
  private readonly root: HTMLElement;
  private tooltipEl: HTMLDivElement | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  install(): void {
    this.tooltipEl = document.createElement('div');
    this.tooltipEl.className = 'ui-tooltip hidden';
    document.body.append(this.tooltipEl);
    this.root.addEventListener('mouseover', this.onMouseOver);
    this.root.addEventListener('mouseout', this.onMouseOut);
    this.root.addEventListener('mousemove', this.onMouseMove);
  }

  dispose(): void {
    this.root.removeEventListener('mouseover', this.onMouseOver);
    this.root.removeEventListener('mouseout', this.onMouseOut);
    this.root.removeEventListener('mousemove', this.onMouseMove);
    this.tooltipEl?.remove();
    this.tooltipEl = null;
  }

  private onMouseOver = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null;
    const tooltip = target?.closest<HTMLElement>('[data-tooltip]')?.dataset.tooltip;
    if (!tooltip || !this.tooltipEl) return;
    this.tooltipEl.textContent = tooltip;
    this.tooltipEl.classList.remove('hidden');
  };

  private onMouseOut = (event: MouseEvent): void => {
    const anchor = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-tooltip]');
    if (anchor?.contains(event.relatedTarget as Node | null)) return;
    this.tooltipEl?.classList.add('hidden');
  };

  private onMouseMove = (event: MouseEvent): void => {
    if (!this.tooltipEl || this.tooltipEl.classList.contains('hidden')) return;
    this.tooltipEl.style.left = `${event.clientX + 12}px`;
    this.tooltipEl.style.top = `${event.clientY + 12}px`;
  };
}
