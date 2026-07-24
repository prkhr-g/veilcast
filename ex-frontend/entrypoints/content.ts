import { DetectionEngine, type DetectionType } from "../../detection-core/src/index";
import { defineContentScript } from "wxt/utils/define-content-script";
import {
  normalizeDetectionRegion,
  type DetectionRegion,
  type DetectionRegionType,
  type ShieldState,
  type VielCastMessage,
  type VielCastMessageResponse,
} from "../src/extension/messages";

const ROOT_ID = "vielcast-shield-root";
const MASK_PADDING = 4;
const LISTENER_FLAG = "__vielcastShieldContentScriptLoaded";

export default defineContentScript({
  registration: "runtime",
  matches: [],
  runAt: "document_idle",
  main() {
    const scopedWindow = window as typeof window & { [LISTENER_FLAG]?: boolean };
    if (scopedWindow[LISTENER_FLAG]) return;
    scopedWindow[LISTENER_FLAG] = true;

    let shield: ShieldController | undefined;

    chrome.runtime.onMessage.addListener((message: VielCastMessage, _sender, sendResponse) => {
      try {
        if (!isVielCastMessage(message)) return false;

        if (message.type === "VIELCAST_GET_SHIELD_STATE") {
          sendResponse(ok(state()));
          return true;
        }

        if (message.type === "VIELCAST_ENABLE_SHIELD") {
          shield ??= new ShieldController();
          shield.enable();
          sendResponse(ok(state()));
          return true;
        }

        if (message.type === "VIELCAST_DISABLE_SHIELD") {
          shield?.disable();
          shield = undefined;
          sendResponse(ok(state()));
          return true;
        }

        if (message.type === "VIELCAST_TOGGLE_SHIELD") {
          if (shield?.enabled) {
            shield.disable();
            shield = undefined;
          } else {
            shield ??= new ShieldController();
            shield.enable();
          }
          sendResponse(ok(state()));
          return true;
        }

        if (message.type === "VIELCAST_UPDATE_REGIONS") {
          shield ??= new ShieldController();
          shield.enable();
          shield.renderRegions(message.regions);
          sendResponse(ok(state()));
          return true;
        }

        return false;
      } catch (error) {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unexpected runtime message failure." });
        return true;
      }
    });

    function state(): ShieldState {
      return { enabled: shield?.enabled ?? false, regionCount: shield?.regionCount ?? 0 };
    }
  },
});

function ok(state: ShieldState): VielCastMessageResponse {
  return { ok: true, state };
}

function isVielCastMessage(message: unknown): message is VielCastMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    typeof message.type === "string" &&
    message.type.startsWith("VIELCAST_")
  );
}

class ShieldController {
  readonly detector = new DetectionEngine();
  readonly masks = new Map<string, HTMLElement>();
  readonly resizeObserver = new ResizeObserver(() => this.scheduleRefresh());
  readonly mutationObserver = new MutationObserver(() => this.scheduleRefresh());
  root?: HTMLElement;
  layer?: HTMLElement;
  frame = 0;
  enabled = false;
  regionCount = 0;

  enable(): void {
    if (this.enabled) {
      this.scheduleRefresh();
      return;
    }

    this.enabled = true;
    this.mount();
    this.mutationObserver.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    this.resizeObserver.observe(document.documentElement);
    window.addEventListener("scroll", this.scheduleRefresh, true);
    window.addEventListener("resize", this.scheduleRefresh);
    window.addEventListener("popstate", this.scheduleRefresh);
    this.scheduleRefresh();
  }

  disable(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.mutationObserver.disconnect();
    this.resizeObserver.disconnect();
    window.removeEventListener("scroll", this.scheduleRefresh, true);
    window.removeEventListener("resize", this.scheduleRefresh);
    window.removeEventListener("popstate", this.scheduleRefresh);
    this.masks.clear();
    this.regionCount = 0;
    this.root?.remove();
    this.root = undefined;
    this.layer = undefined;
    this.enabled = false;
  }

  readonly scheduleRefresh = (): void => {
    if (!this.enabled || this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.renderRegions(this.detectRegions());
    });
  };

  renderRegions(regions: DetectionRegion[]): void {
    this.mount();
    const layer = this.layer;
    if (!layer) return;

    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const active = new Set<string>();

    for (const region of regions) {
      const normalized = normalizeDetectionRegion(region, viewport);
      if (!normalized) continue;

      active.add(normalized.id);
      let mask = this.masks.get(normalized.id);
      if (!mask) {
        mask = document.createElement("div");
        mask.className = "vielcast-mask";
        this.masks.set(normalized.id, mask);
        layer.append(mask);
      }
      positionMask(mask, normalized);
    }

    for (const [id, mask] of this.masks) {
      if (!active.has(id)) {
        mask.remove();
        this.masks.delete(id);
      }
    }

    this.regionCount = this.masks.size;
  }

  detectRegions(): DetectionRegion[] {
    const regions: DetectionRegion[] = [];
    const body = document.body;
    if (!body) return regions;

    document.querySelectorAll<HTMLElement>("[data-vielcast-sensitive='true']").forEach((element, index) => {
      const rect = element.getBoundingClientRect();
      if (isVisibleRect(rect) && isVisibleElement(element)) {
        regions.push({
          id: `dev-${index}-${hash(rectKey(rect))}`,
          type: "sensitive-text",
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          confidence: 1,
          label: "Sensitive",
        });
      }
    });

    document.querySelectorAll<HTMLInputElement>("input[type='password']").forEach((input, index) => {
      const rect = input.getBoundingClientRect();
      if (isVisibleRect(rect) && isVisibleElement(input)) {
        regions.push({
          id: `password-${index}-${hash(rectKey(rect))}`,
          type: "password",
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          confidence: 1,
          label: "Password",
        });
      }
    });

    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
      acceptNode: node => {
        const parent = node.parentElement;
        if (!parent || !node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
        if (this.root?.contains(parent)) return NodeFilter.FILTER_REJECT;
        if (["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA"].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
        return isVisibleElement(parent) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });

    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? "";
      for (const detection of this.detector.scan({ source: "dom", content: text })) {
        const type = toRegionType(detection.type);
        if (!type) continue;
        regions.push(...regionsForTextNode(node, detection.id, type, detection.range.start, detection.range.end, detection.confidence));
      }
    }

    return regions;
  }

  mount(): void {
    if (this.root?.isConnected && this.layer) return;

    document.getElementById(ROOT_ID)?.remove();
    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.setAttribute("aria-hidden", "true");
    Object.assign(root.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483647",
      pointerEvents: "none",
      overflow: "hidden",
      background: "transparent",
      contain: "strict",
    });

    const shadow = root.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      .vielcast-shield-layer {
        position: fixed;
        inset: 0;
        pointer-events: none;
        overflow: hidden;
        background: transparent;
      }

      .vielcast-mask {
        position: fixed;
        background: rgba(12, 12, 12, 0.96);
        -webkit-backdrop-filter: blur(20px);
        backdrop-filter: blur(20px);
        border-radius: 6px;
        pointer-events: none;
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08);
      }
    `;
    const layer = document.createElement("div");
    layer.className = "vielcast-shield-layer";
    shadow.append(style, layer);
    (document.documentElement ?? document.body).append(root);
    this.root = root;
    this.layer = layer;
  }
}

function regionsForTextNode(
  node: Node,
  id: string,
  type: DetectionRegionType,
  start: number,
  end: number,
  confidence: number,
): DetectionRegion[] {
  const range = document.createRange();
  try {
    range.setStart(node, start);
    range.setEnd(node, end);
    return [...range.getClientRects()].filter(isVisibleRect).map((rect, index) => ({
      id: `${id}-${index}-${hash(rectKey(rect))}`,
      type,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      confidence,
    }));
  } finally {
    range.detach();
  }
}

function positionMask(mask: HTMLElement, region: DetectionRegion): void {
  const left = Math.max(0, region.x - MASK_PADDING);
  const top = Math.max(0, region.y - MASK_PADDING);
  const right = Math.min(window.innerWidth, region.x + region.width + MASK_PADDING);
  const bottom = Math.min(window.innerHeight, region.y + region.height + MASK_PADDING);

  mask.style.left = `${left}px`;
  mask.style.top = `${top}px`;
  mask.style.width = `${Math.max(0, right - left)}px`;
  mask.style.height = `${Math.max(0, bottom - top)}px`;
}

function toRegionType(type: DetectionType): DetectionRegionType | undefined {
  switch (type) {
    case "api_key":
      return "api-key";
    case "jwt":
    case "database_url":
      return "token";
    case "private_key":
      return "private-key";
    case "password":
      return "password";
    case "email":
      return "email";
    case "phone":
      return "phone";
    case "credit_card":
      return "credit-card";
    case "qr_code":
      return undefined;
  }
}

function isVisibleElement(element: Element): boolean {
  const style = getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

function isVisibleRect(rect: DOMRect): boolean {
  return rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.right >= 0 && rect.top <= window.innerHeight && rect.left <= window.innerWidth;
}

function rectKey(rect: DOMRect): string {
  return `${Math.round(rect.x)}:${Math.round(rect.y)}:${Math.round(rect.width)}:${Math.round(rect.height)}`;
}

function hash(value: string): string {
  let output = 2166136261;
  for (let index = 0; index < value.length; index++) {
    output ^= value.charCodeAt(index);
    output = Math.imul(output, 16777619);
  }
  return (output >>> 0).toString(36);
}
