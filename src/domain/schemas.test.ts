import { newOptionId } from './ids';
import { decimalsSchema, fieldLogicSchema, inputFieldLogicSchema, optionSchema } from './schemas';
import { condition, group, textField } from '../test/fixtures';
import { defaultFieldLogic, defaultInputLogic } from './template';

describe('shared logic schemas', () => {
  it('round-trips the logic of a display-only field, which has no required axis', () => {
    const logic = defaultFieldLogic();

    expect(fieldLogicSchema.parse(logic)).toEqual(logic);
  });

  it('rejects visibility logic that is missing its hide group', () => {
    const { defaultVisible, show } = defaultFieldLogic();

    expect(fieldLogicSchema.safeParse({ defaultVisible, show }).success).toBe(false);
  });

  it('round-trips an input field’s logic, conditions included', () => {
    const target = textField('Type');
    const logic = {
      ...defaultInputLogic(),
      show: group('any', condition(target.id, { kind: 'text', op: 'equals', value: 'Travel' })),
    };

    expect(inputFieldLogicSchema.parse(logic)).toEqual(logic);
  });

  it('requires the required axis on an input field, on top of the visibility axis', () => {
    expect(inputFieldLogicSchema.safeParse(defaultFieldLogic()).success).toBe(false);
    const { defaultVisible, hide, defaultRequired, require, unrequire } = defaultInputLogic();
    expect(
      inputFieldLogicSchema.safeParse({ defaultVisible, hide, defaultRequired, require, unrequire })
        .success,
    ).toBe(false);
  });
});

describe('decimalsSchema', () => {
  it.each([0, 1, 2, 3, 4])('accepts %i decimal places', (decimals) => {
    expect(decimalsSchema.safeParse(decimals).success).toBe(true);
  });

  it.each([-1, 5, 1.5, '2'])('rejects %p', (decimals) => {
    expect(decimalsSchema.safeParse(decimals).success).toBe(false);
  });
});

describe('optionSchema', () => {
  it('round-trips an option', () => {
    const option = { id: newOptionId(), label: 'Travel' };

    expect(optionSchema.parse(option)).toEqual(option);
  });

  it('rejects an option whose ID is not a UUID, so a hand-edited ID is never trusted', () => {
    expect(optionSchema.safeParse({ id: 'travel', label: 'Travel' }).success).toBe(false);
  });
});
