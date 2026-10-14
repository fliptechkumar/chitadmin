"use client"

import { DropdownMenu as Primitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Thin styled wrapper over Radix's dropdown. Built on the primitive rather than
 * hand-rolled so keyboard navigation, focus return, outside-click and viewport
 * collision handling come for free — the parts a bespoke menu usually misses.
 */

const DropdownMenu = Primitive.Root
const DropdownMenuTrigger = Primitive.Trigger

function DropdownMenuContent({
  className,
  sideOffset = 8,
  align = "end",
  ...props
}: React.ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-[70] min-w-[13rem] overflow-hidden rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg",
          // Radix reports where the panel opened from, so it scales out of the
          // trigger rather than from its own centre.
          "origin-[var(--radix-dropdown-menu-content-transform-origin)]",
          "data-[state=open]:animate-scale-in data-[state=closed]:animate-scale-out",
          className
        )}
        {...props}
      />
    </Primitive.Portal>
  )
}

function DropdownMenuItem({
  className,
  destructive = false,
  ...props
}: React.ComponentProps<typeof Primitive.Item> & { destructive?: boolean }) {
  return (
    <Primitive.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors",
        // Radix drives highlight through data-highlighted for pointer and
        // keyboard alike, so hover styles are not duplicated here.
        destructive
          ? "text-danger data-[highlighted]:bg-danger-soft data-[highlighted]:text-danger-soft-foreground"
          : "text-foreground data-[highlighted]:bg-muted",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof Primitive.Label>) {
  return (
    <Primitive.Label className={cn("px-2.5 py-2", className)} {...props} />
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Primitive.Separator>) {
  return (
    <Primitive.Separator
      className={cn("-mx-1.5 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
}
