import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  type Signal,
  type WritableSignal,
  type InputSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideCopy, LucideCopySlash, LucideKeyRound, LucideListOrdered, LucideLockKeyhole } from '@lucide/angular';
import { type Attribute, type Bounds } from '@ramen-suite/core/model';
import { Badge, Input } from '@sushi-kit/angular';
import { AutoselectDirective } from '../../../../../directives/autoselect.directive';
import { TooltipDirective } from '../../../../../directives/tooltip.directive';
import { StorageService } from '../../../../../services/storage.service';
import { WorkspaceService } from '../../../../../services/workspace/workspace.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'nori-node-attribute',
  imports: [
    FormsModule,
    AutoselectDirective,
    Input,
    TranslocoDirective,
    TooltipDirective,
    Badge,
    LucideCopy,
    LucideCopySlash,
    LucideListOrdered,
    LucideKeyRound,
    LucideLockKeyhole,
  ],
  templateUrl: './node-attribute.component.html',
})
export class NodeAttributeComponent {
  private readonly storage: StorageService = inject(StorageService);
  private readonly translations: TranslocoService = inject(TranslocoService);
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);

  public readonly inlineRename: InputSignal<boolean> = input(false);

  public readonly nodeId: InputSignal<string | undefined> = input();
  public readonly modelSlot: InputSignal<number> = input(0);
  public readonly attribute: InputSignal<Attribute | undefined> = input();

  protected readonly editingName: WritableSignal<boolean> = signal(false);
  protected readonly draftName: WritableSignal<string> = signal('');
  protected readonly savingName: WritableSignal<boolean> = signal(false);
  protected readonly canRename: Signal<boolean> = computed(
    (): boolean =>
      this.inlineRename() && this.workspace.view.nodeEditable() && this.workspace.store.currentSlot() === this.modelSlot(),
  );

  public constructor() {
    effect((): void => {
      this.attribute();
      this.nodeId();
      this.editingName.set(false);
    });
  }

  protected handleStartRename(): void {
    const property: Attribute | undefined = this.attribute();
    if (!property || !this.canRename() || this.savingName()) return;
    this.draftName.set(property.name);
    this.editingName.set(true);
  }

  protected handleCancelRename(): void {
    this.editingName.set(false);
  }

  protected async handleSaveName(): Promise<void> {
    const property: Attribute | undefined = this.attribute();
    const nodeId: string | undefined = this.nodeId();
    if (!this.editingName() || this.savingName() || !property || !nodeId || !this.canRename()) return;

    const name: string = this.draftName().trim();
    if (!name || name === property.name) {
      this.handleCancelRename();
      return;
    }

    this.savingName.set(true);
    try {
      await this.workspace.actions.updateAttribute(nodeId, property.id, { name });
      this.handleCancelRename();
    } catch (error: unknown) {
      this.storage.reportError(error);
    } finally {
      this.savingName.set(false);
    }
  }

  protected isMultiValue(bounds: Bounds): boolean {
    return bounds.upperBound === -1 || bounds.upperBound > 1;
  }

  protected formatAttributeCount(bounds: Bounds): string | null {
    const { lowerBound: minimum, upperBound: maximum } = bounds;
    const translate: (key: string, params?: Record<string, number>) => string = (key, params = {}): string =>
      this.translations.translate(`editor.propertyCount.${key}`, params);

    if (maximum === 0) return translate('none');
    if (maximum === 1 || (maximum === -1 && minimum <= 1)) return null;
    if (minimum === maximum) return translate('exact', { count: minimum });
    if (maximum === -1) return translate('atLeast', { count: minimum });
    if (minimum <= 1) return translate('atMost', { count: maximum });
    return translate('range', { minimum, maximum });
  }
}
