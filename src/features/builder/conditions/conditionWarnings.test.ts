import type { Field } from '../../../domain/template';
import { condition, group, numberField, sectionField, textField } from '../../../test/fixtures';
import {
  ALREADY_VISIBLE_HINT,
  type ConditionWarning,
  conditionWarnings,
  newWarnings,
} from './conditionWarnings';

const amount = numberField('Amount');
const over50 = () => group('all', condition(amount.id, { kind: 'number', op: 'gt', value: 50 }));
const codes = (field: Field) => conditionWarnings(field).map(({ code, effect }) => [code, effect]);

function receipt(change: (field: ReturnType<typeof textField>) => void = () => undefined) {
  const field = textField('Receipt number');
  change(field);
  return field;
}

describe('conditionWarnings', () => {
  it('gives a field with no conditions no warnings', () => {
    expect(conditionWarnings(receipt())).toEqual([]);
  });

  it('notes that show conditions do nothing on a field that is already visible (D-3)', () => {
    const field = receipt((f) => (f.logic.show = over50()));

    expect(conditionWarnings(field)).toEqual([
      { code: 'noOp', effect: 'show', message: ALREADY_VISIBLE_HINT },
    ]);
  });

  it('notes that hide conditions change nothing on a field that starts hidden with nothing showing it', () => {
    const field = receipt((f) => {
      f.logic.defaultVisible = false;
      f.logic.hide = over50();
    });

    expect(codes(field)).toEqual([
      ['neverShown', null],
      ['noOp', 'hide'],
    ]);
    expect(conditionWarnings(field)[1]?.message).toBe(
      'This field already starts hidden and nothing shows it, so these conditions change nothing.',
    );
  });

  it('warns that hide wins when a hidden-at-start field has both show and hide conditions (D-2)', () => {
    const field = receipt((f) => {
      f.logic.defaultVisible = false;
      f.logic.show = over50();
      f.logic.hide = over50();
    });

    expect(conditionWarnings(field)).toEqual([
      {
        code: 'opposing',
        effect: 'hide',
        message: 'If Show and Hide both match, the field stays hidden.',
      },
    ]);
  });

  it('warns that respondents never see a field that starts hidden with nothing showing it', () => {
    const field = receipt((f) => (f.logic.defaultVisible = false));

    expect(conditionWarnings(field)).toEqual([
      {
        code: 'neverShown',
        effect: null,
        message: 'This field starts hidden and nothing shows it, so respondents never see it.',
      },
    ]);
  });

  it('notes that not-required conditions do nothing on a field that is already optional (D-3)', () => {
    const field = receipt((f) => (f.logic.unrequire = over50()));

    expect(conditionWarnings(field)).toEqual([
      {
        code: 'noOp',
        effect: 'unrequire',
        message:
          'This field is already optional, so these conditions only matter if Required is on.',
      },
    ]);
  });

  it('notes that required conditions do nothing on a field that is already required, while nothing makes it optional', () => {
    const field = receipt((f) => {
      f.logic.defaultRequired = true;
      f.logic.require = over50();
    });

    expect(conditionWarnings(field)).toEqual([
      {
        code: 'noOp',
        effect: 'require',
        message:
          'This field is already required, so these conditions only matter if it is optional.',
      },
    ]);
  });

  it('warns that require wins when a required field has both required and not-required conditions (D-2)', () => {
    const field = receipt((f) => {
      f.logic.defaultRequired = true;
      f.logic.require = over50();
      f.logic.unrequire = over50();
    });

    expect(conditionWarnings(field)).toEqual([
      {
        code: 'opposing',
        effect: 'require',
        message: 'If both match, the field is required: Mark as required wins.',
      },
    ]);
  });

  it('says nothing when each group changes the default it starts from', () => {
    const optional = receipt((f) => (f.logic.require = over50()));
    const required = receipt((f) => {
      f.logic.defaultRequired = true;
      f.logic.unrequire = over50();
    });
    const hiddenAtStart = receipt((f) => {
      f.logic.defaultVisible = false;
      f.logic.show = over50();
    });

    expect([optional, required, hiddenAtStart].flatMap(conditionWarnings)).toEqual([]);
  });

  it('checks only visibility on a section header, which has no required axis', () => {
    const heading = sectionField('Approval');
    heading.logic.show = over50();

    expect(codes(heading)).toEqual([['noOp', 'show']]);
  });
});

describe('newWarnings', () => {
  const noOpShow: ConditionWarning = { code: 'noOp', effect: 'show', message: 'a' };
  const neverShown: ConditionWarning = { code: 'neverShown', effect: null, message: 'b' };

  it('returns only the warnings that were not there before', () => {
    expect(newWarnings([noOpShow], [noOpShow, neverShown])).toEqual([neverShown]);
  });

  it('returns nothing when warnings only went away or stayed', () => {
    expect(newWarnings([noOpShow, neverShown], [noOpShow])).toEqual([]);
  });

  it('tells the same code on different groups apart', () => {
    const noOpHide: ConditionWarning = { code: 'noOp', effect: 'hide', message: 'c' };

    expect(newWarnings([noOpShow], [noOpHide])).toEqual([noOpHide]);
  });
});
