import type { JSX } from "@solidjs/web";
import { Form as FormboxForm, type FormInstance, type FormSchema } from "@prestgg/formbox";
import type { Static } from "@sinclair/typebox";
import { createContext, createSignal, useContext } from "solid-js";

import { cn } from "~/lib/cn";
import { split } from "~/lib/split";
import { buttonVariants } from "~/ui/button";

/**
 * Form — a validated form, built on `@prestgg/formbox`.
 *
 * ```tsx
 * const schema = Type.Object({ email: Type.String({ format: "email" }) });
 * const form = createForm(schema);
 *
 * <Form form={form} onSubmit={save} class="grid gap-6">
 *   <FormSubmit>Save</FormSubmit>
 * </Form>
 * ```
 *
 * This is a thin layer, and deliberately so: values, validation, touched
 * state and submit handling all live in `createForm`. What is added here is
 * the presentation shadcn expects — a form-level layout, a submit button that
 * reflects `submitting`, and somewhere to report a submit that *threw*,
 * which is the one error with no field to attach to.
 *
 * `FormSubmit` deliberately does not disable itself on `!valid()`. A greyed
 * -out button tells the user nothing about what is missing; one that submits
 * and lights up the offending fields teaches them the rule.
 *
 * The per-field pieces live in `field.tsx` and are re-exported here, so a
 * form is importable from one place.
 */

export {
  Field,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
} from "./field";
export { ErrorMessage } from "@prestgg/formbox";

const FormInstanceContext = createContext<FormInstance<FormSchema>>();

/**
 * The form instance of the nearest enclosing `Form`.
 *
 * formbox keeps its own context and does not export a reader for it, so
 * `Form` provides the instance a second time. That is the cost of building on
 * a library that keeps its internals private, and it buys not having to
 * reimplement validation.
 *
 * Throws outside a `Form`, because every caller is a form part by definition
 * and a silent `undefined` would only surface as a crash further along.
 */
export function useForm(): FormInstance<FormSchema> {
  const form = useContext(FormInstanceContext);
  if (!form) throw new Error("Form parts must be used inside a <Form>.");
  return form;
}

export interface FormProps extends Omit<JSX.FormHTMLAttributes<HTMLFormElement>, "onSubmit"> {
  /** The form instance from `createForm`. */
  form: FormInstance<FormSchema>;
  /** Called with the validated values. Not called when validation fails. */
  onSubmit: (values: Static<FormSchema>) => void | Promise<void>;
}

export function Form(props: FormProps): JSX.Element {
  const [local, rest] = split(props, ["form", "onSubmit", "class", "children"]);

  const [error, setError] = createSignal<string>();

  // formbox rethrows nothing and swallows nothing, so a throwing handler is
  // the only way a submit can fail after validation passed. Reporting it
  // beats leaving the user with a button that did nothing.
  const onSubmit = async (values: Static<FormSchema>) => {
    try {
      setError(undefined);
      await local.onSubmit(values);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <FormInstanceContext value={local.form}>
      <FormboxForm
        form={local.form}
        onSubmit={onSubmit}
        class={cn("grid w-full gap-6", local.class)}
        {...rest}
      >
        {error() !== undefined && (
          <div
            data-slot="form-error"
            role="alert"
            class="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {error()}
          </div>
        )}
        {local.children}
      </FormboxForm>
    </FormInstanceContext>
  );
}

interface FormSubmitProps {
  class?: string;
  children?: JSX.Element;
  [key: string]: unknown;
}

/**
 * The submit button.
 *
 * `aria-disabled` rather than `disabled`: the button stays focusable, so a
 * screen reader can still reach it and hear why it is inert. A truly disabled
 * button is skipped entirely, and the user is left guessing.
 */
export function FormSubmit(props: FormSubmitProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);

  // Read through a function: the component body runs before the form context
  // is reachable from a sibling, and `submitting` changes over the form's life.
  const form = useForm();
  const submitting = (): boolean => form.submitting();

  return (
    <button
      type="submit"
      data-slot="form-submit"
      data-state={submitting() ? "loading" : "idle"}
      aria-disabled={submitting() ? "true" : "false"}
      aria-busy={submitting() ? "true" : "false"}
      class={cn(buttonVariants(), local.class)}
      {...rest}
    >
      <span class={cn("grid", submitting() && "invisible")}>{local.children}</span>
      {submitting() && (
        <span data-slot="form-submit-spinner" aria-hidden="true" class="absolute inset-0 grid place-items-center">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            class="size-4 animate-spin"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        </span>
      )}
    </button>
  );
}