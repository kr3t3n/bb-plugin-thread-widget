import { defineRpcContract, type StandardSchemaV1 } from "@get-bb/plugin-sdk";

function schema<T>(parse: (value: unknown) => T | null): StandardSchemaV1<T> {
  return {
    "~standard": {
      version: 1,
      vendor: "thread-widget",
      validate(value) {
        const parsed = parse(value);
        if (parsed === null) return { issues: [{ message: "Invalid value" }] };
        return { value: parsed };
      },
    },
  };
}

const empty = schema((value) => (value === undefined || value === null ? {} : typeof value === "object" ? {} : null));

const origins = schema((value) => {
  if (value === null || typeof value !== "object") return null;
  const row = value as { localOrigin?: unknown; cloudOrigin?: unknown };
  if (typeof row.localOrigin !== "string") return null;
  if (row.cloudOrigin !== null && typeof row.cloudOrigin !== "string") return null;
  return { localOrigin: row.localOrigin, cloudOrigin: row.cloudOrigin ?? null };
});

export const linkContract = defineRpcContract({
  linkOrigins: {
    input: empty,
    output: origins,
  },
});
