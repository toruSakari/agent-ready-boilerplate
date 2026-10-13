import { applicationRoles } from "#tooling/lint/application-roles.ts";
import { noDestructuredParameters } from "#tooling/lint/no-destructured-parameters.ts";
import {
  oneValueObjectPerFile,
  oneDtoPerFile,
} from "#tooling/lint/one-branded-definition-per-file.ts";
import { entityClass } from "#tooling/lint/entity-class.ts";
import { brandedDto } from "#tooling/lint/branded-dto.ts";
import { readableSpacing } from "#tooling/lint/readable-spacing.ts";
import { repositoryResponsibilities } from "#tooling/lint/repository-responsibilities.ts";
import { definePlugin } from "vite-plus/lint/plugins";
import { noRelativeImports } from "#tooling/lint/import-boundaries.ts";
import { oneComponentPerFile } from "#tooling/lint/one-component-per-file.ts";
import { singleValueObject } from "#tooling/lint/single-value-object.ts";

import { reactFunctionLines } from "#tooling/lint/react-function-lines.ts";

export default definePlugin({
  meta: { name: "project" },
  rules: {
    "application-roles": applicationRoles,
    "no-destructured-parameters": noDestructuredParameters,
    "one-value-object-per-file": oneValueObjectPerFile,
    "one-dto-per-file": oneDtoPerFile,
    "entity-class": entityClass,
    "readable-spacing": readableSpacing,
    "branded-dto": brandedDto,
    "repository-responsibilities": repositoryResponsibilities,
    "no-relative-imports": noRelativeImports,
    "one-component-per-file": oneComponentPerFile,
    "single-value-object": singleValueObject,
    "react-function-lines": reactFunctionLines,
  },
});
