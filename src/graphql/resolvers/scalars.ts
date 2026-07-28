import { GraphQLScalarType, Kind } from "graphql";

export const DateScalar = new GraphQLScalarType({
  name: "Date",
  description: "ISO-8601 date-time scalar",
  serialize(value) {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "string" || typeof value === "number") return new Date(value).toISOString();
    return null;
  },
  parseValue(value) {
    if (typeof value === "string" || typeof value === "number") return new Date(value);
    throw new TypeError("Date must be a string or number");
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING || ast.kind === Kind.INT) return new Date(ast.value);
    return null;
  },
});
