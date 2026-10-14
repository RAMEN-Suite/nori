import {
  afterNextRender,
  ElementRef,
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
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideArrowRight, LucideSearch, LucideX } from '@lucide/angular';
import { Button, List, ListItemTemplate } from '@sushi-kit/angular';
import {
  type AffectedLevel,
  type AffectedModelLevel,
  type AffectedNode,
  type AffectedRelation,
  type RemovalLocation,
} from '../../../../../utils/removal-summary';
import { ScrollOverflowDirective } from '../../../../../directives/scroll-overflow.directive';
import { type ConfirmationMessage } from '../../../../../models/ConfirmationMessage';
import { DialogService } from '../../../../../services/dialog.service';
import { RemovalReviewService, type RemovalReviewPosition } from '../../../../../services/removal-review.service';
import { ScrollHintsComponent } from '../../../shared/scroll-hints/scroll-hints.component';

export type { AffectedNode } from '../../../../../utils/removal-summary';

interface MessagePart {
  readonly text: string;
  readonly emphasized: boolean;
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
  ],
  templateUrl: './confirmation-content.component.html',
  styleUrl: './confirmation-content.component.scss',
})
export class ConfirmationContentComponent {
  protected readonly dialogs: DialogService = inject(DialogService);
  private readonly review: RemovalReviewService = inject(RemovalReviewService);
  private readonly injector: Injector = inject(Injector);
  private readonly detailViewport: Signal<ElementRef<HTMLElement> | undefined> =
    viewChild<ElementRef<HTMLElement>>('detailViewport');
  public readonly reviewPosition: InputSignal<RemovalReviewPosition | null> = input<RemovalReviewPosition | null>(null);
  private trigger: HTMLElement | null = null;
  protected readonly selection: WritableSignal<ImpactKind | null> = signal(null);
  private readonly translations: TranslocoService = inject(TranslocoService);
  private readonly language: Signal<string> = toSignal(this.translations.langChanges$, {
    initialValue: this.translations.getActiveLang(),
  });

  public readonly message: InputSignal<ConfirmationMessage> = input.required<ConfirmationMessage>();
  public readonly details: InputSignal<readonly string[]> = input<readonly string[]>([]);
  public readonly affectedNodes: InputSignal<readonly AffectedNode[]> = input<readonly AffectedNode[]>([]);
  public readonly affectedRelations: InputSignal<readonly AffectedRelation[]> = input<readonly AffectedRelation[]>([]);
  public readonly affectedLevels: InputSignal<readonly AffectedModelLevel[]> = input<readonly AffectedModelLevel[]>([]);

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
        .sort((left, right): number => (left.modelSlot ?? Infinity) - (right.modelSlot ?? Infinity))
        .map((item: AffectedModelLevel): ImpactEntry => ({ kind: 'item', item }));
    }
    const items: readonly AffectedItem[] = this.selection() === 'nodes' ? this.affectedNodes() : this.affectedRelations();
    const groups: Map<string, { level: AffectedLevel; items: AffectedItem[] }> = new Map();
    for (const item of items) {
      const key: string = JSON.stringify([item.modelSlot, item.modelName]);
      const group: { level: AffectedLevel; items: AffectedItem[] } = groups.get(key) ?? { level: item, items: [] };
      group.items.push(item);
      groups.set(key, group);
    }
    return [...groups.values()]
      .sort((a, b): number => (a.level.modelSlot ?? Infinity) - (b.level.modelSlot ?? Infinity))
      .flatMap((group, index: number): ImpactEntry[] => [
        { kind: 'group', level: group.level, subsequent: index > 0 },
        ...group.items.map((item: AffectedItem): ImpactEntry => ({ kind: 'item', item })),
      ]);
  });

  public constructor() {
    effect((): void => {
      if (!this.dialogs.detailsOpen()) {
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

  protected async inspect(location: RemovalLocation): Promise<void> {
    const selection: ImpactKind | null = this.selection();
    if (!selection) return;
    await this.review.inspect(location, { selection, scrollTop: this.detailViewport()?.nativeElement.scrollTop ?? 0 });
  }

  protected impactLabel(action: ImpactAction): string {
    const labels: { singular: string; plural: string; title: string } = this.impactLabels[action.kind];
    return action.count === 1 ? labels.singular : labels.plural;
  }

  protected showDetails(kind: ImpactKind, event: Event): void {
    if (this.selection() === kind) {
      this.dialogs.detailsOpen.set(false);
      return;
    }
    this.trigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    this.selection.set(kind);
    this.dialogs.detailsOpen.set(true);
  }

  protected readonly messageParts: Signal<readonly MessagePart[]> = computed((): readonly MessagePart[] => {
    this.language();
    const message: ConfirmationMessage = this.message();
    if (typeof message === 'string') return [{ text: message, emphasized: false }];
    const tokens: Record<string, string> = Object.fromEntries(
      Object.keys(message.params).map((key: string): [string, string] => [key, `\uFFF0${key}\uFFF1`]),
    );
    const translated: string = this.translations.translate(message.key, tokens);
    return translated
      .split(/(\uFFF0[^\uFFF1]+\uFFF1)/u)
      .filter(Boolean)
      .map(
        (part: string): MessagePart =>
          part.startsWith('\uFFF0') && part.endsWith('\uFFF1')
            ? { text: message.params[part.slice(1, -1)] ?? '', emphasized: true }
            : { text: part, emphasized: false },
      );
  });
}
