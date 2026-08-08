import { test } from "node:test";
import { ok, strictEqual } from "node:assert";
import {
  PRODUCT_NAME,
  PRODUCT_TAGLINE,
  PRODUCT_WINDOW_TITLE,
  PRODUCT_BRAND_TEXT,
} from "../northwing/DesignSystem/productText";

test("brand: product name is Northwing", () => {
  ok(PRODUCT_NAME === "Northwing", "product name must be Northwing");
});

test("brand: tagline is correct", () => {
  ok(PRODUCT_BRAND_TEXT.tagline.includes("finished work"), "tagline reflects Work-first");
});

test("brand: attribution says powered by", () => {
  ok(
    PRODUCT_BRAND_TEXT.kernelAttribution.toLowerCase().includes("powered by"),
    "attribution must disclose kernel",
  );
  ok(
    PRODUCT_BRAND_TEXT.kernelAttribution.includes("Reasonix"),
    "attribution must reference Reasonix kernel",
  );
});

test("brand: about description includes Northwing", () => {
  ok(PRODUCT_BRAND_TEXT.aboutDescription.includes("Northwing"), "about mentions Northwing");
  ok(PRODUCT_BRAND_TEXT.aboutDescription.includes("Work-first"), "about describes Work-first");
});

test("brand: tagline not empty", () => {
  ok(PRODUCT_TAGLINE.length > 0, "tagline must not be empty");
});

test("brand: window title is Northwing", () => {
  strictEqual(PRODUCT_WINDOW_TITLE, "Northwing");
});

test("brand: copyright mentions Northwing", () => {
  ok(PRODUCT_BRAND_TEXT.copyright.includes("Northwing"), "copyright mentions Northwing");
});