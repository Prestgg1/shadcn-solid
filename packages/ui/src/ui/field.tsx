import { Field as FormboxField, type FormSchema } from "@prestgg/formbox";
import type { JSX } from "@solidjs/web";
import { Show, createContext, createUniqueId, useContext } from "solid-js";

import { cn } from "~/lib/cn";
import { asChild } from "~/lib/slot";
import { split } from "~/lib/split";
import { Label } from "~/ui/label";
import { useForm } from "~/ui/form";

/**
 * Field — a text input bound to the enclosing `FormField`.
 *
 * ```tsx
 * <FormField name="email">
 *   <FormItem>
 *     <FormLabel>Email</FormLabel>
 *     <FormControl><Field type="email" /></FormControl>
 *   </FormItem>
 * </FormField>
 * ```
 *
 * The name comes from `FormField` rather than being repeated here: writing it
 * twice is a chance to write it twice *differently*, and the mismatch shows up
 * as a field that validates nothing.
 *
 * Only the text control is wrapped. Anything with its own value — `Select`,
 * `Switch`, a checkbox — is bound with `form.setValue` directly, since none of
 * them takes an input's `value`/`onInput` pair.
 */

/** One control with its label, description and error.
 *
 * ```tsx
 * <FormField name="email">
 *   <FormItem>
 *     <FormLabel>Email</FormLabel>
 *     <FormControl><Field type="email" /></FormControl>
 *     <FormDescription>We only use this to reply.</FormDescription>
 *     <FormMessage />
 *   </FormItem>
 * </FormField>
 * ```
 *
 * The whole point of splitting it up this way is the wiring. `FormField` mints
 * the ids once, `FormLabel` points its `for` at the control, `FormDescription`
 * and `FormMessage` both feed `aria-describedby`, and `FormControl` sets
 * `aria-invalid` the moment validation complains. A caller who forgets one of
 * those loses the connection between the control and the text describing it,
 * which is precisely the wiring a form is judged on.
 *
 * `FormControl` takes the control rather than rendering one, because the
 * control is formbox's `<Field>` — this library does not know which input the
 * caller wants, and does not need to.
 */

/**
 * formbox's own input props, minus the name we supply from context.
 *
 * Spelled out rather than derived with `ComponentProps`: formbox's `Field` is
 * a plain function component, so its props are an object type and the indexed
 * access `ComponentProps<F>[0]` does not apply.
 */
export interface FieldProps
  extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "value" | "onInput" | "onBlur"> {
  [key: string]: unknown;
}

interface FieldContextValue {
  /** The field's name in the form. */
  name: string;
  /** The control's id, referenced by the label. */
  id: string;
  /** Ids of the description and the error, in that order. */
  descriptionId: string;
  messageId: string;
  /** The validation message, if this field has been touched and is wrong. */
  error: () => string | undefined;
}

const FieldContext = createContext<FieldContextValue>();

/** The current field's ids and error. Throws outside a `FormField`. */
export function useFormField(): FieldContextValue {
  const field = useContext(FieldContext);
  if (!field) throw new Error("Form field parts must be used inside a <FormField>.");
  return field;
}

export interface FormFieldProps {
  name: string;
  children?: JSX.Element;
  class?: string;
  [key: string]: unknown;
}

/** Provides the ids and the error for one field. */
export function FormField(props: FormFieldProps): JSX.Element {
  const [local, rest] = split(props, ["name", "children", "class"]);
  const form = useForm();

  const base = createUniqueId();

  return (
    <FieldContext
      value={{
        name: local.name,
        id: `${base}-field`,
        descriptionId: `${base}-description`,
        messageId: `${base}-message`,
        // Read through the instance every time: the message appears and
        // disappears as the field is touched and corrected.
        error: () => form.error(local.name),
      }}
    >
      <div data-slot="form-field" class={cn("contents", local.class)} {...rest}>
        {local.children}
      </div>
    </FieldContext>
  );
}

/** A text input, bound to the enclosing `FormField`'s name. */
export function Field(props: FieldProps): JSX.Element {
  const [local, rest] = split(props, ["class"]);
  const field = useFormField();

  return <FormboxField name={field.name} class={cn(local.class as string)} {...rest} />;
}

interface PartProps {
  class?: string;
  children?: JSX.Element;
  [key: string]: unknown;
}

/** The row. Reports its own validity, so a whole block can be styled at once. */
export function FormItem(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  const field = useFormField();

  return (
    <div
      data-slot="form-item"
      data-invalid={field.error() ? "" : undefined}
      class={cn("grid gap-2", local.class)}
      {...rest}
    >
      {local.children}
    </div>
  );
}

/** The label, bound to the control by id. */
export function FormLabel(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  const field = useFormField();

  return (
    <Label
      for={field.id}
      data-slot="form-label"
      data-error={field.error() ? "true" : undefined}
      class={cn("data-[error]:text-destructive", local.class)}
      {...rest}
    >
      {local.children}
    </Label>
  );
}

/**
 * The control itself, described.
 *
 * Takes the caller's control as its child and writes the id and ARIA onto it,
 * so any input works — formbox's `<Field>`, a `<textarea>`, or a custom
 * control built from `Select` or a checkbox. `asChild` is what makes that
 * possible; the alternative would be for this to render an `<input>` and
 * quietly rule out everything else.
 */
export function FormControl(props: { children?: JSX.Element }): JSX.Element {
  const field = useFormField();

  const attributes = () => ({
    id: field.id,
    // Only the description while there is no error: a screen reader should
    // announce the description, then the problem, not both at once.
    "aria-describedby": field.error() ? field.messageId : field.descriptionId,
    "aria-invalid": field.error() ? ("true" as const) : undefined,
  });

  return asChild(() => props.children ?? null, () => attributes());
}

/** Help text under the control. */
export function FormDescription(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  const field = useFormField();

  return (
    <Show when={local.children !== undefined}>
      <p
        id={field.descriptionId}
        data-slot="form-description"
        class={cn("text-sm text-muted-foreground", local.class)}
        {...rest}
      >
        {local.children}
      </p>
    </Show>
  );
}

/**
 * The validation message.
 *
 * `aria-live="assertive"` because it arrives *after* the user has already
 * moved on — at submit, or on blur — and a polite announcement would be
 * swallowed by whatever they are doing next. It renders nothing while the
 * field is valid, so the box does not jump when the error clears.
 */
export function FormMessage(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  const field = useFormField();

  return (
    <Show when={field.error()}>
      {(message) => (
        <p
          id={field.messageId}
          data-slot="form-message"
          role="alert"
          aria-live="assertive"
          class={cn("text-sm font-medium text-destructive", local.class)}
          {...rest}
        >
          {local.children ?? message()}
        </p>
      )}
    </Show>
  );
}

/** The type re-exported so a field can be typed without a second import. */
export type { FormSchema };