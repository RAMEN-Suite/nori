import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  DestroyRef,
  ElementRef,
  Injector,
  inject,
  signal,
  viewChild,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideList, LucideTags, LucideShieldCheck, LucideWaypoints, LucideX } from '@lucide/angular';
import { type Attribute, type Constraint } from '@ramen-suite/core/model';
import { RAMEN_ELEMENT } from '@ramen-suite/core/ramen';
import { Button, Menu, MenuItemTemplate, type MenuItem } from '@sushi-kit/angular';
import type { InheritedAttribute, NodeDefinition } from '../../../../models/WorkspaceDetails';
import type { WorkspaceLocation } from '../../../../models/WorkspaceLocation';
import { DialogService } from '../../../../services/interaction/dialog.service';
import { ProjectService } from '../../../../services/projects/project.service';
import { PropertyEditingService } from '../../../../services/workspace/editing/property-editing.service';
import { WorkspaceService, type WorkspaceContext } from '../../../../services/workspace/workspace.service';
import { ApplicationState } from '../../../../states/application.state';
import { ConfirmationDialog, type ConfirmationOptions } from '../../dialogs/confirmation/confirmation.dialog';
import { NotificationsComponent } from '../../shell/notifications/notifications.component';
import { DialogHostComponent } from '../../shell/dialog-host/dialog-host.component';
import { NodeContextPanelComponent } from './node-context-panel/node-context-panel.component';
import { NodeNeighbourhoodComponent } from './node-neighbourhood/node-neighbourhood.component';
import { ShapeEditorComponent } from './shape-editor/shape-editor.component';
import { PropertyDetailsDialog } from '../../dialogs/property-details/property-details.dialog';
import { PropertyListComponent } from './property-list/property-list.component';

/**
 * Lays out the node column (context, neighbourhood, properties, annotations) beside the editing windows.
 * Coordinates property drafts, explicit save decisions and node navigation.
 */
@Component({
  selector: 'nori-property-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(keydown.escape)': 'handleEscape($event)' },
  imports: [
    LucideX,
    TranslocoDirective,
    Button,
    Menu,
    MenuItemTemplate,
    LucideList,
    LucideTags,
    LucideShieldCheck,
    LucideWaypoints,
    PropertyListComponent,
    ShapeEditorComponent,
    NodeContextPanelComponent,
    NodeNeighbourhoodComponent,
    NotificationsComponent,
    DialogHostComponent,
  ],
  templateUrl: './property-editor.component.html',
  styleUrl: './property-editor.component.scss',
})
export class PropertyEditorComponent {
  protected readonly editing: PropertyEditingService = inject(PropertyEditingService);
  protected readonly workspace: WorkspaceService = inject(WorkspaceService);
  protected readonly appearance: ApplicationState = inject(ApplicationState);
  protected readonly dialogs: DialogService = inject(DialogService);
  private readonly translations: TranslocoService = inject(TranslocoService);
  private readonly projects: ProjectService = inject(ProjectService);
  private readonly element: ElementRef<HTMLElement> = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector: Injector = inject(Injector);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  protected readonly shapeEditor: Signal<ShapeEditorComponent | undefined> = viewChild(ShapeEditorComponent);
  private readonly propertyList: Signal<PropertyListComponent | undefined> = viewChild(PropertyListComponent);
  protected readonly switchingNode: WritableSignal<boolean> = signal(false);
  protected readonly initialArrival: WritableSignal<boolean> = signal(true);
  protected readonly detailVisible: WritableSignal<boolean> = signal(true);
  private readonly lifetime: AbortController = new AbortController();

  protected readonly properties: Signal<readonly Attribute[]> = computed(
    () => this.workspace.queries.currentNode()?.attributes ?? [],
  );
  protected readonly controlsUnavailable: Signal<boolean> = computed(
    () => this.dialogs.pending() || this.editing.changingNode() || this.switchingNode(),
  );
  protected readonly actionPending: Signal<boolean> = computed(() => this.controlsUnavailable() || !!this.propertyList()?.busy());

  protected readonly isAnnotation: Signal<boolean> = computed(
    (): boolean =>
      this.workspace.queries.currentNode()?.id === RAMEN_ELEMENT.ANNOTATION ||
      this.workspace.queries.currentNodeChain().some((base): boolean => base.node.id === RAMEN_ELEMENT.ANNOTATION),
  );
  protected readonly annotationsVisible: Signal<boolean> = computed(
    () => this.editing.annotationEditingEnabled && this.isAnnotation(),
  );
  protected readonly windowsShowAnnotations: Signal<boolean> = computed(
    () => this.annotationsVisible() && this.editing.section() === 'shapes',
  );
  protected readonly graphVisible: WritableSignal<boolean> = signal(true);
  protected readonly navigationItems: Signal<readonly MenuItem[]> = computed(() => {
    this.appearance.language();
    return [
      {
        label: this.translations.translate('editor.properties'),
        value: 'properties',
        active: this.editing.section() === 'properties',
      },
      {
        label: this.translations.translate('editor.shapes.title'),
        value: 'shapes',
        active: this.windowsShowAnnotations(),
        disabled: !this.annotationsVisible(),
      },
      {
        label: this.translations.translate('editor.constraints'),
        value: 'constraints',
        active: this.editing.section() === 'constraints',
      },
    ];
  });
  protected readonly nodeConstraints: Signal<readonly Constraint[]> = computed(() => [
    ...this.workspace.queries.currentNodeChain().flatMap((base) => base.node.constraints ?? []),
    ...(this.workspace.queries.currentNode()?.constraints ?? []),
  ]);

  protected switchSection(value: unknown): void {
    if (value !== 'properties' && value !== 'shapes' && value !== 'constraints') return;
    if (value === 'shapes' && !this.annotationsVisible()) return;
    if (!this.canRunAction()) return;
    this.initialArrival.set(false);
    this.editing.section.set(value);
  }

  protected propertyRules(property: Attribute): void {
    this.dialogs.open(PropertyDetailsDialog, {
      headerKey: 'editor.editProperties',
      inputValues: { attribute: property, editable: this.workspace.queries.nodeEditable() },
    });
  }

  protected readonly noRelations: ReadonlySet<string> = new Set();
  protected readonly guardProperties: () => boolean = (): boolean => this.canRunAction();

  public constructor() {
    afterNextRender((): void => {
      this.element.nativeElement.querySelector<HTMLElement>('[data-property-screen-heading]')?.focus({ preventScroll: true });
    });
    this.destroyRef.onDestroy((): void => {
      this.lifetime.abort();
    });
    effect((): void => {
      if (!this.editing.changingNode() && !this.editing.current()) this.editing.close();
    });
    effect((): void => {
      if (!this.annotationsVisible() && this.editing.section() === 'shapes') this.editing.section.set('properties');
    });
  }

  protected activateAnnotations(): void {
    this.initialArrival.set(false);
    this.editing.section.set('shapes');
  }

  protected inspectNeighbour(nodeId: string): void {
    const projectId: string | undefined = this.workspace.context()?.projectId;
    if (!projectId) return;
    const location: WorkspaceLocation = { projectId, levelIndex: this.workspace.store.currentLevelIndex(), nodeId };
    this.runWithCleanDraft(() => this.changeNode(() => this.editing.inspect(location)));
  }

  public close(): void {
    this.runWithCleanDraft((): void => this.editing.close());
  }

  public handleEscape(event: Event): void {
    if (this.dialogs.current()) return;
    event.preventDefault();
    event.stopPropagation();
    this.close();
  }

  protected inspectRefinement(refinement: NodeDefinition): void {
    const projectId: string | undefined = this.workspace.context()?.projectId;
    const levelIndex: number | undefined = this.projects.recordsByModelId().get(refinement.modelId)?.levelIndex;
    if (!projectId || levelIndex === undefined) return;

    const location: WorkspaceLocation = { projectId, levelIndex, nodeId: refinement.node.id };
    this.runWithCleanDraft(() => this.changeNode(() => this.editing.inspect(location)));
  }

  protected inspectNodeSource(location: WorkspaceLocation): void {
    this.runWithCleanDraft(() => this.changeNode(() => this.editing.inspect(location)));
  }

  protected inspectPropertySource(property: InheritedAttribute): void {
    const projectId: string | undefined = this.workspace.context()?.projectId;
    if (!projectId) return;
    const location: WorkspaceLocation = { projectId, levelIndex: property.levelIndex, nodeId: property.nodeId };
    this.runWithCleanDraft(() => this.changeNode(() => this.editing.inspect(location, property.attribute.id)));
  }

  protected forwardToNode(): void {
    this.runWithCleanDraft(() => this.changeNode(() => this.editing.forward()));
  }

  protected backToNode(): void {
    this.runWithCleanDraft(() => this.changeNode(() => this.editing.back()));
  }

  protected remove(property: Attribute): void {
    this.runWithCleanDraft((): void => {
      const nodeId: string | null = this.workspace.store.currentNodeId();
      const context: WorkspaceContext | null = this.workspace.context();
      if (!nodeId || !context) return;
      const options: ConfirmationOptions = {
        title: this.translations.translate('editor.removeProperty'),
        message: { key: 'editor.confirmRemoveProperty', params: { name: property.name } },
        buttons: [
          [
            { label: this.translations.translate('common.cancel') },
            {
              label: this.translations.translate('editor.removeProperty'),
              severity: 'error',
              click: (): Promise<void> => this.confirmRemoval(property, nodeId, context),
            },
          ],
        ],
      };
      this.dialogs.open(ConfirmationDialog, { size: 'compact', header: options.title, inputValues: { options } });
    });
  }

  protected duplicate(property: Attribute): void {
    this.runWithCleanDraft((): Promise<void> => this.duplicateProperty(property));
  }

  private async confirmRemoval(property: Attribute, nodeId: string, context: WorkspaceContext): Promise<void> {
    if (!this.isCurrentNode(context, nodeId)) return;

    const properties: readonly Attribute[] = this.properties();
    const index: number = properties.findIndex((item: Attribute): boolean => item.id === property.id);
    const nextId: string | undefined = properties[index + 1]?.id ?? properties[index - 1]?.id;

    await this.workspace.actions.removeAttribute(nodeId, property.id);
    if (!this.isCurrentNode(context, nodeId)) return;
    this.editing.select(nextId);
  }

  private isCurrentNode(context: WorkspaceContext, nodeId: string): boolean {
    return !this.destroyRef.destroyed && this.workspace.isCurrent(context) && this.workspace.store.currentNodeId() === nodeId;
  }

  private async changeNode(action: () => Promise<boolean>): Promise<void> {
    if (this.actionPending()) return;
    this.switchingNode.set(true);
    try {
      this.lifetime.signal.throwIfAborted();
      const navigated: boolean = await action();
      this.lifetime.signal.throwIfAborted();
      if (navigated) this.detailVisible.set(true);
      await this.waitForRender();
      this.lifetime.signal.throwIfAborted();
      this.focusDetail();
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed) this.projects.reportError(error);
    } finally {
      this.switchingNode.set(false);
    }
  }

  private waitForRender(): Promise<void> {
    return new Promise((resolve): void => {
      const render: ReturnType<typeof afterNextRender> = afterNextRender(
        (): void => {
          unregister();
          resolve();
        },
        { injector: this.injector },
      );
      const unregister: () => void = this.destroyRef.onDestroy((): void => {
        render.destroy();
        resolve();
      });
    });
  }

  private async duplicateProperty(property: Attribute): Promise<void> {
    const nodeId: string | null = this.workspace.store.currentNodeId();
    const context: WorkspaceContext | null = this.workspace.context();
    if (!nodeId || !context) return;

    await this.runPendingAction(async (): Promise<void> => {
      const copy: Attribute = await this.workspace.actions.duplicateAttribute(nodeId, property.id);
      if (this.destroyRef.destroyed || !this.workspace.isCurrent(context) || this.workspace.store.currentNodeId() !== nodeId)
        return;
      this.selectOwnProperty(copy.id);
      this.focusDetail(true);
    });
  }

  private async runPendingAction(action: () => Promise<void>): Promise<boolean> {
    await this.dialogs.run(action, { closeOnSuccess: false });
    const error: string | null = this.dialogs.error();
    if (!error) return true;
    this.projects.reportError(new Error(error));
    this.dialogs.error.set(null);
    return false;
  }

  private selectOwnProperty(attributeId: string | null): void {
    this.editing.section.set('properties');
    this.detailVisible.set(true);
    this.editing.select(attributeId);
  }

  private runWithCleanDraft(action: () => void | Promise<void>): void {
    if (this.canRunAction()) void this.runAction(action);
  }

  private canRunAction(): boolean {
    if (this.actionPending() || this.propertyList()?.guardLeave() === false || this.shapeEditor()?.canLeave() === false)
      return false;
    return true;
  }

  private async runAction(action: () => void | Promise<void>): Promise<void> {
    try {
      await action();
      this.focusDetail();
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed) this.projects.reportError(error);
    }
  }

  private focusSelectedProperty(): boolean {
    const propertyId: string | null | undefined = this.editing.current()?.attributeId;
    const list: PropertyListComponent | undefined = this.propertyList();
    if (!propertyId || !list) return false;
    list.focusProperty(propertyId);
    return true;
  }

  private focusDetail(selectName: boolean = false): void {
    if (this.destroyRef.destroyed) return;
    afterNextRender(
      (): void => {
        if (this.destroyRef.destroyed) return;
        const host: HTMLElement = this.element.nativeElement;
        if (this.focusSelectedProperty()) return;
        const target: HTMLElement | null =
          host.querySelector<HTMLElement>('.property-detail [aria-invalid="true"]') ??
          host.querySelector<HTMLElement>('.property-detail input:not(:disabled)') ??
          host.querySelector<HTMLElement>('.property-detail');
        target?.focus();
        if (selectName && target instanceof HTMLInputElement) {
          queueMicrotask((): void => {
            if (!this.destroyRef.destroyed && target.ownerDocument.activeElement === target) target.select();
          });
        }
      },
      { injector: this.injector },
    );
  }
}
