export class ToastManager {
  private readonly root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  show(message: string): void {
    const toast = document.createElement('article');
    toast.className = 'toast';
    toast.textContent = message;
    this.root.append(toast);
    window.setTimeout(() => {
      toast.classList.add('fade');
      window.setTimeout(() => toast.remove(), 300);
    }, 2200);
  }
}
