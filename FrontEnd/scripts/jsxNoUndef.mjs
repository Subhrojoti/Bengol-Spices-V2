// Core no-undef does not check JSX component names. Catch missing icon/component
// imports even when a permission- or panel-specific branch is not rendered.
export default {
  meta: {
    type: "problem",
    schema: [],
    messages: { undefinedComponent: "JSX component '{{name}}' is not defined." },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        let name = node.name;
        const member = name.type === "JSXMemberExpression";
        while (name.type === "JSXMemberExpression") name = name.object;
        if (name.type !== "JSXIdentifier" || name.name === "this" || name.name.includes("-") || (!member && !/^[A-Z]/.test(name.name))) return;
        let scope = context.sourceCode.getScope(node);
        while (scope) {
          if (scope.set.has(name.name)) return;
          scope = scope.upper;
        }
        context.report({ node: name, messageId: "undefinedComponent", data: { name: name.name } });
      },
    };
  },
};
