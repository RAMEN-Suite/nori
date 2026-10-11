import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { Divider } from '@sushi-kit/angular';
import { NodeAttributesComponent } from './node-attributes/node-attributes.component';
import { NodeBasicsComponent } from './node-basics/node-basics.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-node-editor',
  imports: [TranslocoDirective, NodeBasicsComponent, Divider, NodeAttributesComponent],
  templateUrl: './node-view.component.html',
  styleUrl: './node-view.component.scss',
})
export class NodeViewComponent {}
