import { describe, expect, test } from "bun:test";
import { Type } from "@sinclair/typebox";
import { createForm, type FormInstance, type FormSchema } from "@prestgg/formbox";
import { fireEvent, render } from "@solidjs/testing-library";

import { Form, FormSubmit } from "./form";
import {
  Field,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./field";

const schema = Type.Object({
  email: Type.String({ format: "email" }),
  name: Type.String({ minLength: 2 }),
});

const slot = (name: string) =>
  document.querySelector<HTMLElement>(`[data-slot="${name}"]`);

/** Drain effects and the frame the exit animation unmounts on. */
const settle = async () => {
  for (let i = 0; i < 3; i += 1) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await Promise.resolve();
  }
};

/** A sign-up form wired the way the docs show. */
function Signup(props: {
  form: FormInstance<FormSchema>;
  onSubmit?: (values: unknown) => void;
}) {
  return (
    <Form form={props.form} onSubmit={props.onSubmit ?? (() => {})}>
      <FormField name="email">
        <FormItem>
          <FormLabel>Email</FormLabel>
          <FormControl>
            <Field type="email" />
          </FormControl>
          <FormDescription>We only use this to reply.</FormDescription>
          <FormMessage />
        </FormItem>
      </FormField>

      <FormSubmit>Save</FormSubmit>
    </Form>
  );
}

describe("Form", () => {
  test("renders a form element with a gap", () => {
    const form = createForm(schema);
    const { container } = render(() => <Signup form={form} />);

    expect(container.querySelector("form")).not.toBeNull();
    expect(slot("form-submit")?.getAttribute("type")).toBe("submit");
  });

  test("does not call onSubmit while the form is invalid", async () => {
    const form = createForm(schema);
    let submitted: unknown = null;

    const { container } = render(() => <Signup form={form} onSubmit={(v) => (submitted = v)} />);

    await fireEvent.submit(container.querySelector("form")!);
    expect(submitted).toBeNull();
  });

  test("calls onSubmit with the values once validation passes", async () => {
    const form = createForm(schema, { initialValues: { email: "a@b.co", name: "Ada" } });
    let submitted: unknown = null;

    const { container } = render(() => <Signup form={form} onSubmit={(v) => (submitted = v)} />);

    await fireEvent.submit(container.querySelector("form")!);
    expect(submitted).toEqual({ email: "a@b.co", name: "Ada" });
  });

  test("marks every field touched on a rejected submit, so the errors show", async () => {
    const form = createForm(schema);
    const { container } = render(() => <Signup form={form} />);

    await fireEvent.submit(container.querySelector("form")!);
    await settle();

    expect(form.touched("email")).toBe(true);
    expect(form.errors().email).toBeDefined();
  });

  test("reports a submit that threw, since it has no field to attach to", async () => {
    const form = createForm(schema, { initialValues: { email: "a@b.co", name: "Ada" } });

    const { container } = render(() => (
      <Signup
        form={form}
        onSubmit={() => {
          throw new Error("Email already in use");
        }}
      />
    ));

    await fireEvent.submit(container.querySelector("form")!);
    await settle();

    const alert = slot("form-error");
    expect(alert?.getAttribute("role")).toBe("alert");
    expect(alert?.textContent).toBe("Email already in use");
  });
});

describe("FormSubmit", () => {
  test("is not disabled while the form is invalid", async () => {
    const form = createForm(schema);
    render(() => <Signup form={form} />);

    // A greyed-out button says nothing about what is missing; this one
    // submits and lights up the offending fields instead.
    expect(slot("form-submit")?.hasAttribute("disabled")).toBe(false);
  });

  test("reports busy state while the handler runs", async () => {
    const form = createForm(schema, { initialValues: { email: "a@b.co", name: "Ada" } });
    const { container } = render(() => (
      <Signup form={form} onSubmit={() => new Promise((resolve) => setTimeout(resolve, 20))} />
    ));

    expect(slot("form-submit")?.getAttribute("aria-busy")).toBe("false");

    await fireEvent.submit(container.querySelector("form")!);
    expect(slot("form-submit")?.getAttribute("aria-busy")).toBe("true");
    expect(slot("form-submit")?.getAttribute("aria-disabled")).toBe("true");
    expect(slot("form-submit-spinner")).not.toBeNull();

    // The handler is a real timer, not a microtask.
    await Bun.sleep(40);
    expect(slot("form-submit")?.getAttribute("aria-busy")).toBe("false");
  });
});

describe("FormField", () => {
  test("binds the label to the control by id", () => {
    const form = createForm(schema);
    const { container } = render(() => <Signup form={form} />);

    const label = slot("form-label")!;
    const input = container.querySelector<HTMLElement>("input")!;

    expect(label.getAttribute("for")).toBe(input.id);
    expect(input.id).not.toBe("");
  });

  test("describes the control with the help text", () => {
    const form = createForm(schema);
    const { container } = render(() => <Signup form={form} />);

    const input = container.querySelector<HTMLElement>("input")!;
    const description = slot("form-description")!;

    expect(input.getAttribute("aria-describedby")).toBe(description.id);
    expect(description.textContent).toBe("We only use this to reply.");
  });

  test("shows no message until the field is touched", async () => {
    const form = createForm(schema);
    const { container } = render(() => <Signup form={form} />);

    // Validating on the way in would flag every field the user has not
    // reached yet, which reads as a form that is already failing.
    expect(slot("form-message")).toBeNull();

    await fireEvent.blur(container.querySelector("input")!);
    await settle();

    expect(slot("form-message")).not.toBeNull();
  });

  test("swaps the description for the message and marks the control invalid", async () => {
    const form = createForm(schema);
    const { container } = render(() => <Signup form={form} />);
    const input = container.querySelector<HTMLElement>("input")!;

    await fireEvent.blur(input);
    await settle();

    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(slot("form-message")!.id);
    // Announcing the problem is more useful than repeating the help text.
    expect(input.getAttribute("aria-describedby")).not.toBe(slot("form-description")!.id);
  });

  test("clears aria-invalid once the value is fixed", async () => {
    const form = createForm(schema);
    const { container } = render(() => <Signup form={form} />);
    const input = container.querySelector<HTMLInputElement>("input")!;

    await fireEvent.blur(input);
    await settle();
    expect(input.getAttribute("aria-invalid")).toBe("true");

    await fireEvent.input(input, { target: { value: "a@b.co" } });
    await settle();

    expect(input.getAttribute("aria-invalid")).toBeNull();
    expect(slot("form-message")).toBeNull();
  });

  test("the message is announced assertively — it arrives after the fact", async () => {
    const form = createForm(schema);
    const { container } = render(() => <Signup form={form} />);

    await fireEvent.blur(container.querySelector("input")!);
    await settle();

    const message = slot("form-message")!;
    expect(message.getAttribute("aria-live")).toBe("assertive");
    expect(message.getAttribute("role")).toBe("alert");
  });

  test("marks the whole row invalid so a block can be styled at once", async () => {
    const form = createForm(schema);
    const { container } = render(() => <Signup form={form} />);

    expect(slot("form-item")?.hasAttribute("data-invalid")).toBe(false);

    await fireEvent.blur(container.querySelector("input")!);
    await settle();

    expect(slot("form-item")?.hasAttribute("data-invalid")).toBe(true);
  });

  test("typing through the control updates the form", async () => {
    const form = createForm(schema);
    const { container } = render(() => <Signup form={form} />);
    const input = container.querySelector<HTMLInputElement>("input")!;

    await fireEvent.input(input, { target: { value: "a@b.co" } });
    await settle();

    expect(form.values().email).toBe("a@b.co");
  });

  test("FormControl accepts any element, not just an input", () => {
    const form = createForm(schema);
    const { container } = render(() => (
      <Form form={form} onSubmit={() => {}}>
        <FormField name="email">
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              <textarea class="min-h-20" />
            </FormControl>
          </FormItem>
        </FormField>
      </Form>
    ));

    const textarea = container.querySelector<HTMLTextAreaElement>("textarea")!;
    const label = slot("form-label")!;
    // The control's own class survives; only the wiring is added.
    expect(textarea.className).toContain("min-h-20");
    expect(label.getAttribute("for")).toBe(textarea.id);
  });
});