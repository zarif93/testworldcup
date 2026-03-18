# Jackpot Hero – Design Spec (Background & Safe Area)

**Purpose:** Design perfectly sized background images that fit without cropping, stretching, or performance issues.  
**Source of truth:** `client/src/components/JackpotHero.tsx`, `client/src/pages/Home.tsx`, `server/storage/jackpotBackgroundImageProcess.ts`.

---

## 1. Rendered size of the Jackpot background container

The hero lives inside a **max-width container** on the homepage. The banner is **full width of that container** and has a **minimum height** (no fixed aspect ratio). All dimensions below are for the **background area** (the `<section id="jackpot-banner">`).

| Breakpoint | Viewport (typical) | Container max width | Horizontal padding | **Rendered width** | **Min height** |
|------------|--------------------|---------------------|--------------------|--------------------|----------------|
| **Mobile** | &lt; 640px          | 100%                | 12px each side     | **viewport − 24px** (e.g. 351px @ 375px) | **280px** |
| **sm**     | 640px+             | min(100%, 896px)    | 16px each side     | **min(viewport − 32px, 864px)**          | **320px** |
| **md+**    | 768px+             | 896px (max-w-4xl)   | 16px each side     | **864px** (fixed)                        | **360px** |
| **Desktop (FHD / large)** | 1920px+   | 896px               | 16px each side     | **864px**                                | **360px** |

**Notes:**
- Container: `max-w-4xl` = **56rem = 896px** (Tailwind default).
- Padding: `px-3` (12px) &lt; 640px, `px-4` (16px) ≥ 640px.
- So **inner width** = **864px** on desktop/laptop, and **viewport − 24px** or **viewport − 32px** on smaller screens up to 896px.

**Summary (for layout):**
- **Desktop / Laptop:** **864px × 360px** (min height).
- **Tablet (e.g. 768px):** **736px × 360px** (min height).
- **Mobile (e.g. 375px):** **351px × 280px** (min height).

---

## 2. CSS behavior

| Property | Value | Meaning |
|----------|--------|--------|
| **Background size** | `bg-cover` | Image scales to cover the entire container; **cropping** occurs if aspect ratio differs. |
| **Background position** | `bg-center` | Image is **centered** horizontally and vertically. |
| **Height** | **Min-height only** | `min-h-[280px]` / `sm:min-h-[320px]` / `md:min-h-[360px]`. No fixed height, no aspect-ratio. |
| **Sizing** | **Content-based** | Height is driven by content (text, countdown, amount, buttons). Minimum is as above; container can grow if content is taller. |
| **Width** | **100% of parent** | Parent is `max-w-4xl mx-auto px-3 sm:px-4`, so width is as in §1. |
| **Blur placeholder** | `scale-105` | Thumbnail is scaled up 5% to hide blur edges; final image uses `bg-cover` only (no scale). |

**Not used:** `contain`, fixed height in vh, aspect-ratio, or object-fit on the main image (only `background-size: cover`, `background-position: center`).

---

## 3. Safe area (for text and critical UI)

All important UI (title, countdown, amount, primary CTA) is in the **center** of the banner. The background image uses **cover + center**, so edges can be cropped on different viewports.

**Recommended safe zone for design (no critical content outside):**

| Edge | Minimum margin from container edge |
|------|-------------------------------------|
| **Left**  | **15%** of container width (e.g. ~130px on desktop) |
| **Right** | **15%** of container width |
| **Top**   | **18%** of container height (min height used as reference) |
| **Bottom**| **25%** of container height |

**Center focal area (always visible across breakpoints):**
- **Horizontal:** 20%–80% of width (center 60%).
- **Vertical:** 25%–75% of height (center 50%).

**UI positions in code:**
- Content wrapper: `px-5 py-5 sm:py-6` → **20px** inner padding from section edges.
- LIVE badge: `top-3 left-3` → **12px** from top-left; can be covered by image if needed.
- Main content: centered; amount and CTA sit in the middle.

**Designer takeaway:** Keep important subjects and text within the **center 60% × 50%**; avoid placing key elements in the outer 15–20% on sides and in the top/bottom 20–25%.

---

## 4. Recommended design size (Figma / Photoshop)

**Primary (desktop) asset:**
- **1920 × 1080 px** (16∶9) – matches backend max width (1920) and a common aspect; will be served at max 1920px wide and cropped to container height (min 360px, content-dependent).
- Alternative: **1920 × 900 px** – slightly shorter; still safe for cover + center.

**Mobile-specific asset (optional but recommended):**
- **768 × 1024 px** (portrait) or **768 × 900 px** – backend generates mobile at **max width 768px**; height can vary; center 50% vertical is safest.

**Why 1920 width:** Backend resizes to **max 1920px** width; designing at 1920 avoids upscale and gives a single source for desktop.

**Aspect ratio:** No fixed ratio in layout; **16∶9 or 16∶10** are safe and crop predictably with `cover` + `center`.

---

## 5. Max file weight and format

| Rule | Value | Source |
|------|--------|--------|
| **Max file size (upload)** | **8 MB** | Validation in `jackpotBackgroundImageProcess` / admin. |
| **Recommended (after export)** | **&lt; 500 KB** (desktop), **&lt; 200 KB** (mobile) | Performance; images are re-encoded to WebP. |
| **Format (delivery)** | **WebP** | Backend converts to WebP (quality 85 desktop, 80 mobile). |
| **Upload formats accepted** | JPEG, PNG, GIF, WebP | Stored and served as WebP. |

**Recommendation:** Export at **&lt; 500 KB** per image before upload; backend will compress further. Prefer **WebP** for source if possible; otherwise JPEG/PNG is fine.

---

## 6. Responsive behavior and focal point

**Desktop / tablet:**
- Image is **cover + center**. If the image is wider than the container aspect, **sides are cropped**. If taller, **top and bottom are cropped**.
- Focal point: **center (50%, 50%)**. Place the most important part of the image in the **center** to avoid cropping key content.

**Mobile:**
- Same **cover + center**.
- When a **separate mobile image** is provided (max width 768px), it is loaded for viewports **&lt; 768px**.
- Mobile container is **narrow and shorter (min 280px)**; **center 50% horizontal and 40–60% vertical** stays visible; top/bottom and far sides crop first.

**Focal point guidance:**  
Design with the **main subject at center (50%, 50%)** of the canvas; avoid placing critical elements in the outer 15–20% of width and top/bottom 20–25% of height.

---

## 7. Retina / high DPI

| Guidance | Recommendation |
|----------|-----------------|
| **Design at** | **1×** (e.g. 1920×1080). Backend serves at 1920px max width; no 2× asset pipeline for this hero. |
| **Retina display** | Browser scales the 1920px (or 768px mobile) image; quality is sufficient for the current container (max 864px wide). |
| **Future 2×** | If you later serve 2×, design at **3840×2160** and export two versions; current implementation is 1×. |

**Conclusion:** Design at **1×** (1920×1080 or 1920×900). No need for 2× assets in the current setup.

---

## 8. Future-proofing and safest aspect ratio

- Layout uses **min-height only**, no fixed aspect ratio. Height can increase if content (e.g. text, buttons) grows.
- **Safest aspect ratio for the image:** **16∶9** (e.g. 1920×1080). It crops predictably with `cover` + `center` on both wide and narrow viewports.
- **Alternative:** **16∶10** (1920×1200) – a bit taller; still centers well.
- Avoid very tall (e.g. 9∶16) or very wide (e.g. 21∶9) if you want the same crop behavior across breakpoints; **16∶9** is the most future-proof default.

---

## Quick reference

| Item | Value |
|------|--------|
| **Desktop container** | 864px × 360px min |
| **Mobile container** | (viewport − 24px) × 280px min |
| **Background** | `cover` + `center` |
| **Design size** | **1920 × 1080 px** (1×) |
| **Safe zone** | Center 60% × 50%; keep 15% margin sides, 18% top, 25% bottom |
| **Focal point** | 50%, 50% |
| **Max upload** | 8 MB; recommend &lt; 500 KB |
| **Format** | WebP (delivery); upload JPEG/PNG/GIF/WebP |
| **Mobile asset** | 768px max width (e.g. 768×1024 or 768×900) |
| **Retina** | 1× design sufficient |
