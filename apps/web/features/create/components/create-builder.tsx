'use client';

import {
  ADDON_GROUPS,
  CORE_GROUPS,
  type CreateFlags,
  type FlagGroup,
  optionState,
  parseChoice,
  selectionValue,
  type SelectionValues,
  VOCAB_BY_GROUP,
} from 'create-gb-app/preset';
import { BlocksIcon, TerminalIcon } from 'lucide-react';
import { useId } from 'react';

import { Card, CardContent } from '@/components/ui/card';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from '@/components/ui/field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';

import {
  FLAG_GROUP_LABELS,
  optionsFor,
  presentFlagOption,
} from '../data/options';
import { useCreate } from './create-provider';

export function CreateBuilder() {
  return (
    <Card className="rounded-none bg-transparent ring-0">
      <CardContent>
        <FieldGroup className="gap-6">
          {CORE_GROUPS.map((group) => (
            <FlagRadioGroup key={group} group={group} />
          ))}
          <FieldSet>
            <FieldLegend className="relative flex w-full items-center justify-center [&_svg]:size-4">
              <div className="bg-background flex items-center gap-2 rounded-sm border px-2 py-1">
                <BlocksIcon />
                <span>Add-ons</span>
              </div>
              <div className="bg-border absolute -z-1 ml-2 h-px w-full flex-1 grow" />
            </FieldLegend>
            {ADDON_GROUPS.map((group) => (
              <FlagRadioGroup key={group} group={group} />
            ))}
          </FieldSet>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

function FlagRadioGroup({ group }: { group: FlagGroup }) {
  const id = useId();
  const { flags, setFlag } = useCreate();
  const selected = selectionValue(flags, group);

  return (
    <FieldSet>
      <FieldLegend variant="label" className="flex w-full items-center gap-2">
        <TerminalIcon className="text-muted-foreground size-3.5" />
        {FLAG_GROUP_LABELS[group]}
      </FieldLegend>
      <RadioGroup
        value={selected}
        onValueChange={(value) => {
          assignFlag(group, value, flags, setFlag);
        }}
        className="grid grid-cols-1 gap-2 lg:grid-cols-2"
      >
        {optionsFor(group).map((rawOption) => {
          const option = presentFlagOption(rawOption, flags);
          const optionId = `${id}-${option.value}`;
          const state = optionState(flags, group, option.value);
          const enabled = state.enabled;
          const reason = state.enabled ? null : state.message;

          return (
            <FieldLabel
              key={option.value}
              htmlFor={optionId}
              className={enabled ? undefined : 'cursor-not-allowed opacity-60'}
            >
              <Field
                orientation="horizontal"
                className="relative items-start"
                data-disabled={!enabled || undefined}
              >
                <RadioGroupItem
                  id={optionId}
                  value={option.value}
                  disabled={!enabled}
                />
                <FieldContent className="pr-12">
                  <FieldTitle>{option.label}</FieldTitle>
                  {enabled ? (
                    <FieldDescription className="text-balance">
                      {option.description}
                    </FieldDescription>
                  ) : reason ? (
                    <FieldDescription>{reason}</FieldDescription>
                  ) : null}
                </FieldContent>
                {option.icon && (
                  <option.icon
                    className={cn(
                      'absolute top-3 right-3 size-6 shrink-0 self-center',
                      option.value === 'none' && 'text-muted-foreground'
                    )}
                    aria-hidden
                  />
                )}
              </Field>
            </FieldLabel>
          );
        })}
      </RadioGroup>
    </FieldSet>
  );
}

function assignFlag(
  group: FlagGroup,
  value: unknown,
  flags: CreateFlags,
  setFlag: <K extends FlagGroup>(key: K, value: SelectionValues[K]) => void
) {
  if (typeof value !== 'string') {
    return;
  }
  const selection = parseChoice(group, value, VOCAB_BY_GROUP[group]);
  if (!optionState(flags, group, selection).enabled) {
    return;
  }
  setFlag(group, selection);
}
