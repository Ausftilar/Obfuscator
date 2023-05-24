const { RefactorSession } = require("shift-refactor");
const { parseScript } = require("shift-parser");
const Shift = require("shift-ast");
const fs = require("fs");

function obfuscateFPScript(src, dest) {
  // Читаем содержимое переданного файла (не обфусцированное)
  const fileContents = fs.readFileSync(src, "utf8");

  // Используя shift-ast библиотеку парсим скрипт и строим ast
  const tree = parseScript(fileContents);

  // Инициализируем сессию рефакторинга используя для запроса узлов дерева
  const refactor = new RefactorSession(tree);

  const stringsProgram = Array.from(
    new Set(refactor.query("LiteralStringExpression").map((v) => v.value)),
  );
  const numbersProgram = Array.from(
    new Set(refactor.query("LiteralNumericExpression").map((v) => v.value)),
  );
  const bindingProperties = Array.from(
    new Set(
      refactor
        .query(
          'AssignmentExpression[binding.type="StaticMemberAssignmentTarget"]',
        )
        .map((v) => v.binding.property),
    ),
  );
  const expStatementStr = Array.from(
    new Set(
      refactor
        .query(
          'ExpressionStatement[expression.expression.type="StaticMemberExpression"]',
        )
        .map((exp) => exp.expression.expression.property),
    ),
  );
  const staticMemberStr = Array.from(
    new Set(refactor.query("StaticMemberExpression").map((v) => v.property)),
  );

  // Cодержит атрибуты, которые нужно обфусцировать
  const staticLiterals = stringsProgram.concat(
    numbersProgram,
    bindingProperties,
    expStatementStr,
    staticMemberStr,
  );

  [
    "AsyncFunction",
    "adblock",
    "div",
    "&nbsp;",
    "adsbox",
    "canvas",
    "rgb(255,255,0)",
    "timezone",
    0,
    400,
    200,
    10,
    ..."screenX",
    "pageXOffset",
    "pageYOffset",
    "clientWidth",
  ];

  const staticLiteralToIndex = new Map(
    staticLiterals.map((lit, idx) => [lit, idx]),
  );

  refactor.query("Script")[0].statements.unshift(
    new Shift.VariableDeclarationStatement({
      declaration: new Shift.VariableDeclaration({
        kind: "const",
        declarators: [
          new Shift.VariableDeclarator({
            binding: new Shift.BindingIdentifier({
              name: "members",
            }),
            init: new Shift.ArrayExpression({
              elements: staticLiterals.map((lit) => {
                if (typeof lit === "string") {
                  return new Shift.LiteralStringExpression({
                    value: new Buffer.from(lit).toString("base64"),
                  });
                } else if (typeof lit === "number") {
                  return new Shift.LiteralNumericExpression({
                    value: lit,
                  });
                }
              }),
            }),
          }),
        ],
      }),
    }),
  );
  
  const indexToStr = `
    function indexToLiteral(index, arr) {
      if (typeof arr[index] ==='string') return atob(arr[index]);
        return arr[index];
    }`;
  
  
  const indexToStrAst = parseScript(indexToStr).statements[0];
  refactor.query("Script")[0].statements.unshift(indexToStrAst);
  
  // Метод, помогающий легче создавать выражения вызовов
  function buildIndexToLitCallExpression(index) {
    return new Shift.CallExpression({
      callee: new Shift.IdentifierExpression({
        name: "indexToLiteral",
      }),
      arguments: [
        new Shift.LiteralNumericExpression({
          value: index,
        }),
        new Shift.IdentifierExpression({
          name: "members",
        }),
      ],
    });
  }
  
  // Преобразование строк и чисел, используемых в аргументах функций
  refactor.query("CallExpression").forEach((callExpression) => {
    callExpression.arguments.forEach((argument, idx) => {
      if (
        argument.type === "LiteralStringExpression" ||
        argument.type === "LiteralNumericExpression"
      ) {
        callExpression.arguments[idx] = buildIndexToLitCallExpression(
          staticLiteralToIndex.get(argument.value),
        );
      }
    });
  });
  
  // Присвоения вида myobj.prop = val; => myobj[func(idx, arr)] = val;
  refactor
    .query('AssignmentExpression[binding.type="StaticMemberAssignmentTarget"]')
    .forEach((assignmentExpression) => {
      assignmentExpression.binding = new Shift.ComputedMemberAssignmentTarget({
        object: assignmentExpression.binding.object,
        expression: buildIndexToLitCallExpression(
          staticLiteralToIndex.get(assignmentExpression.binding.property),
        ),
      });
    });
  
  // Строки и числа в оператораях-выражениях
  refactor
    .query(
      ':matches(ExpressionStatement[expression.expression.type="LiteralStringExpression"], ' +
        'ExpressionStatement[expression.expression.type="LiteralNumericExpression"])',
    )
    .forEach((exp) => {
      exp.expression.expression = buildIndexToLitCallExpression(
        staticLiteralToIndex.get(exp.expression.expression.value),
      );
    });
  
  // Строки и числа в объявлении переменных
  refactor.query("VariableDeclarationStatement").forEach((exp) => {
    exp.declaration.declarators.forEach((declarator) => {
      if (
        declarator.init.type === "LiteralNumericExpression" ||
        declarator.init.type === "LiteralStringExpression"
      ) {
        declarator.init = buildIndexToLitCallExpression(
          staticLiteralToIndex.get(declarator.init.value),
        );
      }
    });
  });
  
  // Сделать доступ к полям и методам объекта динамическим
  refactor.query("StaticMemberExpression").forEach((exp) => {
    exp.type = "ComputedMemberExpression";
    exp.expression = buildIndexToLitCallExpression(
      staticLiteralToIndex.get(exp.property),
    );
    delete exp.property;
  });
  
  // Генерирует код из получившегося AST дерева и сохраняет его в файл
  fs.writeFileSync(dest, refactor.print(), "utf8");
}

exports.obfuscate = obfuscateFPScript;
