import { ChangeDetectionStrategy, Component, inject, input, type InputSignal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideLink2, LucideX } from '@lucide/angular';
import { type RelationSuggestion } from '@ramen-suite/core/model';
import { Button, List, ListItemTemplate } from '@sushi-kit/angular';
import { DialogService } from '../../../../services/interaction/dialog.service';
import { ProjectService } from '../../../../services/projects/project.service';

@Component({
  selector: 'nori-choose-relation-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideX, TranslocoDirective, Button, List, ListItemTemplate, LucideLink2],
  templateUrl: './choose-relation.dialog.html',
  styleUrl: './choose-relation.dialog.scss',
})
export class ChooseRelationDialog {
  protected readonly projects: ProjectService = inject(ProjectService);
  protected readonly dialogs: DialogService = inject(DialogService);
  protected readonly endpointMarkers: RegExp = /(\{from\}|\{to\})/u;

  public readonly fromName: InputSignal<string> = input('');
  public readonly toName: InputSignal<string> = input('');
  public readonly choices: InputSignal<readonly RelationSuggestion[]> = input.required();
  public readonly connect: InputSignal<(ref: string) => Promise<void>> = input.required();

  protected async handleChoose(ref: string): Promise<void> {
    await this.dialogs.run((): Promise<void> => this.connect()(ref));
  }
}
