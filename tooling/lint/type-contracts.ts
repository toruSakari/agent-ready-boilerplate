import type { ESTree } from "vite-plus/lint/plugins";

export type TypeNode = ESTree.TSType | ESTree.TSInterfaceBody;

export type TypeDeclaration = ESTree.TSTypeAliasDeclaration | ESTree.TSInterfaceDeclaration;

export type SeenTypes = Set<string | ParameterBinding>;

export interface ParameterSource {
  type: ESTree.TSType;
  declaration: ESTree.TSInterfaceDeclaration;
}

export interface MergedParameter {
  name: string;
  constraint?: ParameterSource;
  default?: ParameterSource;
}

export interface MergedInterface extends ESTree.TSInterfaceDeclaration {
  mergedDeclarations: ESTree.TSInterfaceDeclaration[];
  mergedParameters: MergedParameter[];
}

export interface TypeEnvironment {
  aliases: Map<string, TypeDeclaration | MergedInterface | null>;
  shadowed: Set<string>;
  localTypes: Set<string>;
  className?: string;
  classNode?: ESTree.Class;
  classAugmented?: boolean;
  parameters?: Map<string, ParameterBinding>;
}

export interface TypeTarget<T extends TypeNode = TypeNode> {
  type: T | null | undefined;
  environment: TypeEnvironment;
  seen: SeenTypes;
  exact?: boolean;
  identity?: ParameterBinding | null;
  candidates?: TypeTarget[];
  targets?: TypeTarget[];
  declaration?: TypeDeclaration;
  incomplete?: boolean;
  nonNullable?: boolean;
  inhabited?: boolean;
}

export interface ParameterBinding extends TypeTarget {}

export type PresentTarget<T extends TypeNode = TypeNode> = TypeTarget<T> & { type: T };

export type InferredCandidates = Map<string, TypeTarget[]>;

export type MatchResult = boolean | null;
