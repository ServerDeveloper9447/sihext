export interface EntityMeta {
  bboxRefs: string[];
  type: string;
}

export class EntityLabelManager {
  private hashToLabel = new Map<string, string>();
  private entityMap = new Map<string, EntityMeta>();
  private counters: Record<string, number> = {};

  private hash(value: string): string {
    let h = 0;
    const norm = value.trim().toLowerCase();
    for (let i = 0; i < norm.length; i++) {
      h = (h << 5) - h + norm.charCodeAt(i);
      h |= 0;
    }
    return `${h}`;
  }

  public getLabelForValue(value: string, type: string, ref: string): string {
    const key = `${type}:${this.hash(value)}`;
    let label = this.hashToLabel.get(key);
    if (!label) {
      label = this.nextLabel(type);
      this.hashToLabel.set(key, label);
    }
    this.entityMap.set(label, { type, bboxRefs: [ref] });
    return label;
  }

  public getNewLabel(type: string, ref: string): string {
    const label = this.nextLabel(type);
    this.entityMap.set(label, { type, bboxRefs: [ref] });
    return label;
  }

  private nextLabel(type: string): string {
    this.counters[type] = (this.counters[type] || 0) + 1;
    return `${type}-${this.counters[type]}`;
  }

  public getEntityMap() {
    return this.entityMap;
  }

  public reset() {
    this.hashToLabel.clear();
    this.entityMap.clear();
    this.counters = {};
  }
}