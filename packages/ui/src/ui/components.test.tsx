import { describe, expect, test } from "bun:test";
import { render } from "@solidjs/testing-library";

import { Alert, AlertDescription, AlertTitle } from "./alert";
import { Badge } from "./badge";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Checkbox } from "./checkbox";
import { Kbd, KbdGroup } from "./kbd";
import { Label } from "./label";
import { Progress } from "./progress";
import { RadioGroup } from "./radio-group";
import { Separator } from "./separator";
import { Spinner } from "./spinner";
import { Switch } from "./switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";
import { Textarea } from "./textarea";

describe("every component carries a data-slot", () => {
  test("on its root and on every part", () => {
    const { container } = render(() => (
      <Alert variant="destructive">
        <AlertTitle>Failed</AlertTitle>
        <AlertDescription>Try again</AlertDescription>
      </Alert>
    ));
    expect(container.querySelector('[data-slot="alert"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="alert-title"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="alert-description"]')).not.toBeNull();
  });

  test("so an agent can find the anatomy by grep", () => {
    const { container } = render(() => (
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent>Body</CardContent>
      </Card>
    ));
    for (const slot of ["card", "card-header", "card-title", "card-content"]) {
      expect(container.querySelector(`[data-slot="${slot}"]`)).not.toBeNull();
    }
  });
});

describe("Alert", () => {
  test("is announced as an alert and reflects its variant", () => {
    const { getByRole, container } = render(() => <Alert variant="destructive" />);
    expect(getByRole("alert")).toBeDefined();
    expect(container.querySelector('[data-slot="alert"]')?.className).toContain("text-destructive");
  });
});

describe("Badge", () => {
  test("exposes the variant for styling", () => {
    const { container } = render(() => <Badge variant="outline">Beta</Badge>);
    const badge = container.querySelector('[data-slot="badge"]');
    expect(badge?.getAttribute("data-variant")).toBe("outline");
    expect(badge?.textContent).toBe("Beta");
  });
});

describe("Table", () => {
  test("wraps the table in a scroll container", () => {
    const { container } = render(() => (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Ada</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    ));
    expect(container.querySelector('[data-slot="table-container"]')).not.toBeNull();
    expect(container.querySelectorAll("th").length).toBe(1);
    expect(container.querySelectorAll("td").length).toBe(1);
  });
});

describe("Separator", () => {
  test("is decorative by default, and hidden from assistive tech", () => {
    const { container } = render(() => <Separator />);
    const element = container.querySelector('[data-slot="separator"]');
    expect(element?.getAttribute("role")).toBeNull();
    expect(element?.getAttribute("aria-hidden")).toBe("true");
  });

  test("becomes a real separator when decorative is false", () => {
    const { container } = render(() => <Separator decorative={false} />);
    const element = container.querySelector('[data-slot="separator"]');
    expect(element?.getAttribute("role")).toBe("separator");
    expect(element?.getAttribute("aria-orientation")).toBe("horizontal");
  });
});

describe("Progress", () => {
  test("reports its value", () => {
    const { getByRole } = render(() => <Progress value={42} />);
    const bar = getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("42");
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
  });

  test("clamps out-of-range values", () => {
    const { getByRole } = render(() => <Progress value={140} />);
    expect(getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100");
  });

  test("drops aria-valuenow when the value is null", () => {
    const { getByRole } = render(() => <Progress value={null} />);
    const bar = getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBeNull();
    expect(bar.getAttribute("aria-valuetext")).toBe("Loading");
  });
});

describe("form controls", () => {
  test("Checkbox is a real checkbox and reports its state", () => {
    let next: boolean | undefined;
    const { container } = render(() => <Checkbox checked={false} onChange={(v) => (next = v)} />);
    const input = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(input).not.toBeNull();
    expect(input?.checked).toBe(false);

    input!.checked = true;
    input!.dispatchEvent(new Event("change", { bubbles: true }));
    expect(next).toBe(true);
  });

  test("Switch carries role=switch", () => {
    const { getByRole } = render(() => <Switch checked />);
    expect(getByRole("switch")).toBeDefined();
  });

  test("RadioGroup renders one radio per option under a shared name", () => {
    const { container } = render(() => (
      <RadioGroup
        name="plan"
        value="yearly"
        options={[
          { value: "monthly", label: "Monthly" },
          { value: "yearly", label: "Yearly" },
        ]}
      />
    ));
    const radios = container.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    expect(radios.length).toBe(2);
    expect(radios[1]?.checked).toBe(true);
    expect(container.querySelector('[data-slot="radio-group"]')?.getAttribute("role")).toBe("radiogroup");
  });

  test("Label points at its control through for", () => {
    const { container } = render(() => <Label for="email">Email</Label>);
    expect(container.querySelector("label")?.getAttribute("for")).toBe("email");
  });

  test("Textarea keeps its rows", () => {
    const { container } = render(() => <Textarea rows={4} />);
    expect(container.querySelector("textarea")?.getAttribute("rows")).toBe("4");
  });
});

describe("Kbd", () => {
  test("renders a key and a group", () => {
    const { container } = render(() => (
      <KbdGroup>
        <Kbd>K</Kbd>
      </KbdGroup>
    ));
    expect(container.querySelector("kbd[data-slot='kbd']")).not.toBeNull();
    expect(container.querySelector('[data-slot="kbd-group"]')).not.toBeNull();
  });
});

describe("Spinner", () => {
  test("announces itself and needs no icon library", () => {
    const { getByRole } = render(() => <Spinner />);
    const svg = getByRole("status");
    expect(svg.tagName.toLowerCase()).toBe("svg");
    expect(svg.getAttribute("aria-label")).toBe("Loading");
  });
});
