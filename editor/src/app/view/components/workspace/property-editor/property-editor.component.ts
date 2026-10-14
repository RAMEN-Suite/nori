import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  viewChild,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideChevronDown, LucideEraser, LucidePencil, LucidePlus, LucideTrash, LucideUndo2, LucideX } from '@lucide/angular';
import type { Attribute } from '@ramen-suite/core/model';
import { Badge, Button } from '@sushi-kit/angular';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { DialogService } from '../../../../services/dialog.service';
import { PropertyEditingService } from '../../../../services/workspace/property-editing.service';
import { WorkspaceService } from '../../../../services/workspace/workspace.service';
import { ConfirmationContentComponent } from '../../dialogs/confirmation/confirmation-content/confirmation-content.component';
import { PropertyFormComponent } from './property-form/property-form.component';

@Component({
  selector: 'nori-property-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucidePencil,
    LucideUndo2,
    LucideX,
    TranslocoDirective,
    Badge,
    Button,
    LucideChevronDown,
    LucideEraser,
    LucidePlus,
    LucideTrash,
    PropertyFormComponent,
    TooltipDirective,
    ConfirmationContentComponent,
  ],
  templateUrl: './property-editor.component.html',
  styleUrl: './property-editor.component.scss',
})
export class PropertyEditorComponent {
  protected readonly editing: PropertyEditingService = inject(PropertyEditingService);
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly properties: Signal<readonly Attribute[]> = computed(
    () => this.workspace.queries.currentNode()?.attributes ?? [],
  );
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly form: Signal<PropertyFormComponent | undefined> = viewChild(PropertyFormComponent);
  protected readonly formPending: Signal<boolean> = computed(() => this.dialogs.pending());
  protected readonly collapsed: WritableSignal<boolean> = signal(false);
  protected readonly discarding: WritableSignal<boolean> = signal(false);
  protected readonly removing: WritableSignal<Attribute | null> = signal(null);
  private requestedAction: (() => void) | null = null;

  protected readonly attribute: Signal<Attribute | undefined> = computed(() =>
    this.workspace.queries.currentNode()?.attributes.find((attribute) => attribute.id === this.editing.current()?.attributeId),
  );

  public constructor() {
    effect((): void => {
      if (!this.editing.current()) this.editing.close();
    });
  }

  protected select(attributeId: string | null): void {
    if (attributeId !== null && attributeId === this.editing.current()?.attributeId) {
      this.request((): void => this.collapsed.update((collapsed: boolean): boolean => !collapsed));
      return;
    }
    this.request((): void => {
      this.collapsed.set(false);
      this.editing.select(attributeId);
    });
  }

  protected discard(): void {
    const action: (() => void) | null = this.requestedAction;
    this.form()?.reset();
    this.keepEditing();
    action?.();
  }

  protected keepEditing(): void {
    this.discarding.set(false);
    this.requestedAction = null;
  }

  protected reset(): void {
    this.form()?.reset();
  }

  protected cancelNew(): void {
    if (this.properties().length) this.editing.select();
    else this.reset();
  }

  protected remove(property: Attribute): void {
    this.request((): void => this.removing.set(property));
  }

  protected cancelRemoval(): void {
    this.removing.set(null);
    this.dialogs.error.set(null);
  }

  protected async confirmRemoval(): Promise<void> {
    const property: Attribute | null = this.removing();
    const nodeId: string | null = this.workspace.store.currentNodeId();
    if (!property || !nodeId) return;
    await this.dialogs.run((): Promise<void> => this.workspace.actions.removeAttribute(nodeId, property.id), {
      closeOnSuccess: false,
    });
    if (!this.dialogs.error()) {
      this.removing.set(null);
      this.editing.select();
    }
  }

  private request(action: () => void): void {
    if (this.formPending()) return;
    if (this.form()?.hasChanges()) {
      this.requestedAction = action;
      this.discarding.set(true);
    } else action();
  }
}
