import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { NodeAttributesComponent } from './node-attributes/node-attributes.component';
import { NodeBasicsComponent } from './node-basics/node-basics.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'nori-node-view',
  imports: [TranslocoDirective, NodeBasicsComponent, NodeAttributesComponent],
  templateUrl: './node-view.component.html',
  styleUrl: './node-view.component.scss',
})
export class NodeViewComponent {}
