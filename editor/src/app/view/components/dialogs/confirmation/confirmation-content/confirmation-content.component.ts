import {
  afterNextRender,
  type ElementRef,
  Injector,
  viewChild,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
  effect,
  type InputSignal,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { TranslocoDirective, translateSignal } from '@jsverse/transloco';
import { LucideArrowRight, LucideSearch, LucideX, LucideBox, LucideSpline, LucideLayers } from '@lucide/angular';
import { Button, List, ListItemTemplate } from '@sushi-kit/angular';
import {
  type AffectedLevel,
  type AffectedModelLevel,
  type AffectedNode,
  type AffectedRelation,
} from '../../../../../utils/removal-summary';
import { ScrollOverflowDirective } from '../../../../../directives/scroll-overflow.directive';
import { type WorkspaceLocation } from '../../../../../models/WorkspaceLocation';
import { type ConfirmationMessage } from '../../../../../models/ConfirmationMessage';
import { DialogService } from '../../../../../services/interaction/dialog.service';
import {
  RemovalReviewService,
  type RemovalReviewPosition,
} from '../../../../../services/workspace/workflows/removal-review.service';
import { ScrollHintsComponent } from '../../../shared/scroll-hints/scroll-hints.component';

export type { AffectedNode } from '../../../../../utils/removal-summary';

interface MessagePart {
  readonly text: string;
  readonly emphasised: boolean;
}

type AffectedItem = AffectedNode | AffectedRelation | AffectedModelLevel;
type ImpactEntry =
  | { readonly kind: 'group'; readonly level: AffectedLevel; readonly subsequent: boolean }
  | { readonly kind: 'item'; readonly item: AffectedItem };

type ImpactKind = RemovalReviewPosition['selection'];
interface ImpactAction {
  readonly kind: ImpactKind;
  readonly count: number;
}
@Component({
  selector: 'nori-confirmation-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ScrollOverflowDirective,
    ScrollHintsComponent,
    TranslocoDirective,
    List,
    ListItemTemplate,
    Button,
    LucideArrowRight,
    LucideX,
    LucideSearch,
    LucideBox,
    LucideSpline,
    LucideLayers,
  ],
  templateUrl: './confirmation-content.component.html',
  styleUrl: './confirmation-content.component.scss',
})
export class ConfirmationContentComponent {
  protected readonly dialogs: DialogService = inject(DialogService);
  private readonly review: RemovalReviewService = inject(RemovalReviewService);
  private readonly injector: Injector = inject(Injector);

  public readonly reviewPosition: InputSignal<RemovalReviewPosition | null> = input<RemovalReviewPosition | null>(null);
  public readonly message: InputSignal<ConfirmationMessage> = input.required<ConfirmationMessage>();
  public readonly details: InputSignal<readonly string[]> = input<readonly string[]>([]);
  public readonly affectedNodes: InputSignal<readonly AffectedNode[]> = input<readonly AffectedNode[]>([]);
  public readonly affectedRelations: InputSignal<readonly AffectedRelation[]> = input<readonly AffectedRelation[]>([]);
  public readonly affectedLevels: InputSignal<readonly AffectedModelLevel[]> = input<readonly AffectedModelLevel[]>([]);

  private readonly detailViewport: Signal<ElementRef<HTMLElement> | undefined> =
    viewChild<ElementRef<HTMLElement>>('detailViewport');

  private trigger: HTMLElement | null = null;
  protected readonly selection: WritableSignal<ImpactKind | null> = signal(null);

  private readonly messageKey: Signal<string> = computed((): string => {
    const message: ConfirmationMessage = this.message();
    return typeof message === 'string' ? '' : message.key;
  });
  private readonly messageTokens: Signal<Record<string, string>> = computed((): Record<string, string> => {
    const message: ConfirmationMessage = this.message();
    if (typeof message === 'string') return {};
    return Object.fromEntries(Object.keys(message.params).map((key: string): [string, string] => [key, `\uFFF0${key}\uFFF1`]));
  });
  private readonly translatedMessage: Signal<string> = translateSignal(this.messageKey, this.messageTokens);

  protected readonly impactLabels: Readonly<Record<ImpactKind, { singular: string; plural: string; title: string }>> = {
    nodes: { singular: 'editor.affectedNodeRemoval', plural: 'editor.affectedNodesRemoval', title: 'editor.affectedNodesLabel' },
    relations: {
      singular: 'editor.affectedRelationRemoval',
      plural: 'editor.affectedRelationsRemoval',
      title: 'editor.affectedRelationsLabel',
    },
    levels: {
      singular: 'editor.affectedLevelRemoval',
      plural: 'editor.affectedLevelsRemoval',
      title: 'editor.affectedLevelsLabel',
    },
  };

  protected readonly impactActions: Signal<readonly ImpactAction[]> = computed((): readonly ImpactAction[] =>
    [
      { kind: 'levels' as const, count: this.affectedLevels().length },
      { kind: 'nodes' as const, count: this.affectedNodes().length },
      { kind: 'relations' as const, count: this.affectedRelations().length },
    ].filter((action: ImpactAction): boolean => action.count > 0),
  );
  protected readonly entries: Signal<readonly ImpactEntry[]> = computed((): readonly ImpactEntry[] => {
    if (this.selection() === 'levels') {
      return [...this.affectedLevels()]
        .sort((left, right): number => (left.modelLevelIndex ?? Infinity) - (right.modelLevelIndex ?? Infinity))
        .map((item: AffectedModelLevel): ImpactEntry => ({ kind: 'item', item }));
    }
    const items: readonly AffectedItem[] = this.selection() === 'nodes' ? this.affectedNodes() : this.affectedRelations();
    const groups: Map<string, { level: AffectedLevel; items: AffectedItem[] }> = new Map();
    for (const item of items) {
      const key: string = JSON.stringify([item.modelLevelIndex, item.modelName]);
      const group: { level: AffectedLevel; items: AffectedItem[] } = groups.get(key) ?? { level: item, items: [] };
      group.items.push(item);
      groups.set(key, group);
    }
    return [...groups.values()]
      .sort((a, b): number => (a.level.modelLevelIndex ?? Infinity) - (b.level.modelLevelIndex ?? Infinity))
      .flatMap((group, index: number): ImpactEntry[] => [
        { kind: 'group', level: group.level, subsequent: index > 0 },
        ...group.items.map((item: AffectedItem): ImpactEntry => ({ kind: 'item', item })),
      ]);
  });
  protected readonly messageParts: Signal<readonly MessagePart[]> = computed((): readonly MessagePart[] => {
    const message: ConfirmationMessage = this.message();
    if (typeof message === 'string') return [{ text: message, emphasised: false }];
    return this.translatedMessage()
      .split(/(\uFFF0[^\uFFF1]+\uFFF1)/u)
      .filter(Boolean)
      .map((part: string): MessagePart =>
        part.startsWith('\uFFF0') && part.endsWith('\uFFF1')
          ? { text: message.params[part.slice(1, -1)] ?? '', emphasised: true }
          : { text: part, emphasised: false },
      );
  });

  public constructor() {
    effect((): void => {
      if (!this.dialogs.isDetailsOpen()) {
        this.selection.set(null);
        this.trigger?.focus({ preventScroll: true });
        this.trigger = null;
      } else if (!this.selection()) {
        this.selection.set(this.reviewPosition()?.selection ?? null);
      }
    });
    effect((): void => {
      const viewport: ElementRef<HTMLElement> | undefined = this.detailViewport();
      const position: RemovalReviewPosition | null = this.reviewPosition();
      if (!viewport || !position) return;
      afterNextRender(
        (): void => {
          viewport.nativeElement.scrollTop = position.scrollTop;
        },
        { injector: this.injector },
      );
    });
  }

  protected async inspect(location: WorkspaceLocation): Promise<void> {
    const selection: ImpactKind | null = this.selection();
    if (!selection) return;
    await this.review.inspect(location, { selection, scrollTop: this.detailViewport()?.nativeElement.scrollTop ?? 0 });
  }

  protected impactName(item: AffectedItem): string {
    return 'name' in item ? item.name : item.modelName;
  }

  protected isAffectedLevel(item: AffectedItem): item is AffectedModelLevel {
    return 'nodeCount' in item;
  }

  protected isAffectedNode(item: AffectedItem): item is AffectedNode {
    return 'propertyCount' in item;
  }

  protected isAffectedRelation(item: AffectedItem): item is AffectedRelation {
    return 'from' in item;
  }

  protected impactLabel(action: ImpactAction): string {
    const labels: { singular: string; plural: string; title: string } = this.impactLabels[action.kind];
    return action.count === 1 ? labels.singular : labels.plural;
  }

  protected showDetails(kind: ImpactKind, event: Event): void {
    if (this.selection() === kind) {
      this.dialogs.isDetailsOpen.set(false);
      return;
    }
    this.trigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    this.selection.set(kind);
    this.dialogs.isDetailsOpen.set(true);
  }
}
