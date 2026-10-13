import { ChangeDetectionStrategy, Component, inject, input, type InputSignal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideArrowRight, LucideLink2, LucideX } from '@lucide/angular';
import { type RelationSuggestion } from '@ramen-suite/core/model';
import { Button, List, ListItemTemplate } from '@sushi-kit/angular';
import { DialogService } from '../../../../services/dialog.service';
import { StorageService } from '../../../../services/storage.service';

@Component({
  selector: 'app-choose-relation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideX, TranslocoDirective, Button, List, ListItemTemplate, LucideArrowRight, LucideLink2],
  templateUrl: './choose-relation.dialog.html',
})
export class ChooseRelationDialog {
  protected readonly storage: StorageService = inject(StorageService);
  protected readonly dialogs: DialogService = inject(DialogService);
  public readonly fromName: InputSignal<string> = input('');
  public readonly toName: InputSignal<string> = input('');
  public readonly choices: InputSignal<readonly RelationSuggestion[]> = input.required();
  public readonly connect: InputSignal<(ref: string) => Promise<void>> = input.required();

  protected async handleChoose(ref: string): Promise<void> {
    await this.dialogs.run((): Promise<void> => this.connect()(ref));
  }
}
