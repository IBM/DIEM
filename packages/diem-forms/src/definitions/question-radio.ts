import { QuestionBase } from './question-base';

export interface IRadioQuestion {
    optionsInfo: any[];
    orientation: string;
}

export class RadioQuestion extends QuestionBase<string> {
    public controlType = 'radio';
    public optionsInfo: any[] = [];
    public orientation: string;

    public constructor(options: any = {}) {
        super(options);
        this.optionsInfo = options.optionsInfo;
        this.orientation = options.orientation || 'horizontal';
    }
}
