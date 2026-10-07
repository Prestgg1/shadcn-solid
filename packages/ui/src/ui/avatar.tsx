import type { JSX } from "@solidjs/web";
import { Show } from "solid-js";
import { split } from "~/lib/split";

import { cn } from "~/lib/cn";

export type AvatarSize = "sm" | "default" | "lg";

export interface AvatarProps {
  size?: AvatarSize;
  class?: string;
  children?: JSX.Element;
  [key: string]: unknown;
}

export interface AvatarImageProps {
  src: string;
  /** Required: a decorative avatar needs an empty alt, not a missing one. */
  alt: string;
  class?: string;
  onError?: () => void;
  [key: string]: unknown;
}

export interface AvatarFallbackProps {
  class?: string;
  children?: JSX.Element;
  [key: string]: unknown;
}

/**
 * A circular portrait with a fallback.
 *
 * ```tsx
 * <Avatar>
 *   <AvatarImage src={user.avatarUrl ?? ""} alt="" />
 *   <AvatarFallback>AD</AvatarFallback>
 * </Avatar>
 * ```
 *
 * `AvatarImage` hides itself when `src` is empty or the load fails, which
 * leaves `AvatarFallback` on screen. An empty `alt` marks the avatar as
 * decorative when the name is already rendered next to it.
 */
export function Avatar(props: AvatarProps): JSX.Element {
  const [local, rest] = split(props, ["class", "size"]);

  return (
    <span
      data-slot="avatar"
      data-size={local.size ?? "default"}
      class={cn(
        "group/avatar relative flex size-8 shrink-0 overflow-hidden rounded-full select-none",
        "data-[size=lg]:size-10 data-[size=sm]:size-6",
        local.class,
      )}
      {...rest}
    />
  );
}

/** The portrait. Renders nothing when `src` is empty or the load fails. */
export function AvatarImage(props: AvatarImageProps): JSX.Element {
  const [local, rest] = split(props, ["class", "src", "onError"]);

  return (
    <Show when={local.src !== ""}>
      <img
        data-slot="avatar-image"
        onError={() => local.onError?.()}
        class={cn("aspect-square size-full", local.class)}
        {...rest}
        src={local.src}
      />
    </Show>
  );
}

/** Shown while there is no image — initials, an icon, a monogram. */
export function AvatarFallback(props: AvatarFallbackProps): JSX.Element {
  const [local, rest] = split(props, ["class"]);

  return (
    <span
      data-slot="avatar-fallback"
      class={cn(
        "flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground",
        "group-data-[size=sm]/avatar:text-xs",
        local.class,
      )}
      {...rest}
    />
  );
}
