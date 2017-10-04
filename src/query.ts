import * as Utils from "./utils";
import * as Lexer from "./lexer";
import * as PrimitiveLiteral from "./primitiveLiteral";
import * as NameOrIdentifier from "./nameOrIdentifier";
import * as Expressions from "./expressions";

export function queryOptions(value: number[] | Uint8Array, index: number, metadataContext?: any): Lexer.Token {
    let token = queryOption(value, index, metadataContext);
    if (!token) return;
    let start = index;
    index = token.next;

    let options = [];
    while (token) {
        options.push(token);
        // &
        if (value[index] !== 0x26) break;
        index++;

        token = queryOption(value, index, metadataContext);
        if (!token) return;
        index = token.next;
    }

    return Lexer.tokenize(value, start, index, { options }, Lexer.TokenType.QueryOptions);
}

export function queryOption(value: number[] | Uint8Array, index: number, metadataContext?: any): Lexer.Token {
    return systemQueryOption(value, index, metadataContext) ||
        aliasAndValue(value, index);
}

export function systemQueryOption(value: number[] | Uint8Array, index: number, metadataContext?: any): Lexer.Token {
    return expand(value, index, metadataContext) ||
        filter(value, index) ||
        format(value, index) ||
        id(value, index) ||
        inlinecount(value, index) ||
        orderby(value, index) ||
        search(value, index) ||
        select(value, index) ||
        skip(value, index) ||
        skiptoken(value, index) ||
        top(value, index);
}

export function id(value: number[] | Uint8Array, index: number): Lexer.Token {
    let start = index;
    if (Utils.equals(value, index, "%24id")) {
        index += 5;
    }else
    if (Utils.equals(value, index, "$id")) {
        index += 3;
    }else return;

    let eq = Lexer.EQ(value, index);
    if (!eq) return;
    index = eq;

    while (value[index] !== 0x26 && index < value.length) index++;
    if (index === eq) return;

    return Lexer.tokenize(value, start, index, Utils.stringify(value, eq, index), Lexer.TokenType.Id);
}

export function expand(value: number[] | Uint8Array, index: number, metadataContext?: any): Lexer.Token {
    let start = index;
    if (Utils.equals(value, index, "%24expand")) {
        index += 9;
    }else
    if (Utils.equals(value, index, "$expand")) {
        index += 7;
    }else return;

    let eq = Lexer.EQ(value, index);
    if (!eq) return;
    index = eq;

    let items = [];
    let token = expandItem(value, index, metadataContext);
    if (!token) return;
    index = token.next;

    while (token) {
        items.push(token);

        let comma = Lexer.COMMA(value, index);
        if (comma) {
            index = comma;
            let token = expandItem(value, index, metadataContext);
            if (!token) return;
            index = token.next;
        }else break;
    }

    return Lexer.tokenize(value, start, index, { items }, Lexer.TokenType.Expand);
}

export function expandItem(value: number[] | Uint8Array, index: number, metadataContext?: any): Lexer.Token {
    let start = index;
    let star = Lexer.STAR(value, index);
    if (star) {
        index = star;
        let ref = Expressions.refExpr(value, index);
        if (ref) {
            index = ref.next;
            return Lexer.tokenize(value, start, index, { path: "*", ref }, Lexer.TokenType.ExpandItem);
        } else {
            let open = Lexer.OPEN(value, index);
            if (open) {
                index = open;
                let token = levels(value, index);
                if (!token) return;
                index = token.next;

                let close = Lexer.CLOSE(value, index);
                if (!close) return;
                index = close;

                return Lexer.tokenize(value, start, index, { path: "*", levels: token }, Lexer.TokenType.ExpandItem);
            }
        }
    }

    let path = expandPath(value, index, metadataContext);
    if (!path) return;
    index = path.next;

    let tokenValue: any = { path };

    let ref = Expressions.refExpr(value, index);
    if (ref) {
        index = ref.next;
        tokenValue.ref = ref;

        let open = Lexer.OPEN(value, index);
        if (open) {
            index = open;

            let option = expandRefOption(value, index);
            if (!option) return;

            let refOptions = [];
            while (option) {
                refOptions.push(option);
                index = option.next;

                let semi = Lexer.SEMI(value, index);
                if (semi) {
                    index = semi;

                    option = expandRefOption(value, index);
                    if (!option) return;
                }else break;
            }

            let close = Lexer.CLOSE(value, index);
            if (!close) return;
            index = close;

            tokenValue.options = refOptions;
        }
    } else {
        let count = Expressions.countExpr(value, index);
        if (count) {
            index = count.next;
            tokenValue.count = count;

            let open = Lexer.OPEN(value, index);
            if (open) {
                index = open;

                let option = expandCountOption(value, index);
                if (!option) return;

                let countOptions = [];
                while (option) {
                    countOptions.push(option);
                    index = option.next;

                    let semi = Lexer.SEMI(value, index);
                    if (semi) {
                        index = semi;

                        option = expandCountOption(value, index);
                        if (!option) return;
                    }else break;
                }

                let close = Lexer.CLOSE(value, index);
                if (!close) return;
                index = close;
                tokenValue.options = countOptions;
            }
        } else {
            let open = Lexer.OPEN(value, index);
            if (open) {
                index = open;

                let option = expandOption(value, index);
                if (!option) return;

                let options = [];
                while (option) {
                    options.push(option);
                    index = option.next;

                    let semi = Lexer.SEMI(value, index);
                    if (semi) {
                        index = semi;

                        option = expandOption(value, index);
                        if (!option) return;
                    }else break;
                }

                let close = Lexer.CLOSE(value, index);
                if (!close) return;
                index = close;
                tokenValue.options = options;
            }
        }
    }

    return Lexer.tokenize(value, start, index, tokenValue, Lexer.TokenType.ExpandItem);
}

export function expandCountOption(value: number[] | Uint8Array, index: number): Lexer.Token {
    return filter(value, index) ||
        search(value, index);
}

export function expandRefOption(value: number[] | Uint8Array, index: number): Lexer.Token {
    return expandCountOption(value, index) ||
        orderby(value, index) ||
        skip(value, index) ||
        top(value, index) ||
        inlinecount(value, index);
}

export function expandOption(value: number[] | Uint8Array, index: number): Lexer.Token {
    return expandRefOption(value, index) ||
        select(value, index) ||
        expand(value, index) ||
        levels(value, index);
}

export function expandPath(value: number[] | Uint8Array, index: number, metadataContext?: any): Lexer.Token {
    let start = index;
    let path = [];

    let token = NameOrIdentifier.qualifiedEntityTypeName(value, index, metadataContext) ||
        NameOrIdentifier.qualifiedComplexTypeName(value, index, metadataContext);

    if (token) {
        index = token.next;
        path.push(token);
        if (value[index] !== 0x2f) return;
        index++;
        metadataContext = token.value.metadata;
        delete token.value.metadata;
    }

    let complex = NameOrIdentifier.complexProperty(value, index, metadataContext) ||
        NameOrIdentifier.complexColProperty(value, index, metadataContext);
    while (complex) {
        if (value[complex.next] === 0x2f) {
            index = complex.next + 1;
            path.push(complex);

            let complexTypeName = NameOrIdentifier.qualifiedComplexTypeName(value, index, metadataContext);
            if (complexTypeName) {
                if (value[complexTypeName.next] === 0x2f) {
                    index = complexTypeName.next + 1;
                    path.push(complexTypeName);
                }
                metadataContext = complexTypeName.value.metadata;
                delete complexTypeName.value.metadata;
            }

            complex = NameOrIdentifier.complexProperty(value, index, metadataContext) ||
                NameOrIdentifier.complexColProperty(value, index, metadataContext);
        }else break;
    }

    let nav = NameOrIdentifier.navigationProperty(value, index, metadataContext);

    if (!nav) return;
    index = nav.next;
    path.push(nav);
    metadataContext = nav.metadata;
    delete nav.metadata;

    if (value[index] === 0x2f) {
        let typeName = NameOrIdentifier.qualifiedEntityTypeName(value, index + 1, metadataContext);
        if (typeName) {
            index = typeName.next;
            path.push(typeName);
            metadataContext = typeName.value.metadata;
            delete typeName.value.metadata;
        }
    }

    return Lexer.tokenize(value, start, index, path, Lexer.TokenType.ExpandPath);
}

export function search(value: number[] | Uint8Array, index: number): Lexer.Token {
    let start = index;
    if (Utils.equals(value, index, "%24search")) {
        index += 9;
    }else
    if (Utils.equals(value, index, "$search")) {
        index += 7;
    }else return;

    let eq = Lexer.EQ(value, index);
    if (!eq) return;
    index = eq;

    let expr = searchExpr(value, index);
    if (!expr) return;
    index = expr.next;

    return Lexer.tokenize(value, start, index, expr, Lexer.TokenType.Search);
}

export function searchExpr(value: number[] | Uint8Array, index: number): Lexer.Token {
    let token = searchParenExpr(value, index) ||
        searchTerm(value, index);

    if (!token) return;
    let start = index;
    index = token.next;

    let expr = searchAndExpr(value, index) ||
        searchOrExpr(value, index);

    if (expr) {
        const left = Lexer.clone(token);
        token.next = expr.value.next;
        token.value = {
            left: left,
            right: expr.value
        };
        token.type = expr.type;
        token.raw = Utils.stringify(value, token.position, token.next);

        if (token.type === Lexer.TokenType.SearchAndExpression && token.value.right.type === Lexer.TokenType.SearchOrExpression) {
            token.value.left = Lexer.tokenize(value, token.value.left.position, token.value.right.value.left.next, {
                left: token.value.left,
                right: token.value.right.value.left
            }, token.type);
            token.type = token.value.right.type;
            token.value.right = token.value.right.value.right;
        }
    }

    return token;
}

export function searchTerm(value: number[] | Uint8Array, index: number): Lexer.Token {
    return searchNotExpr(value, index) ||
        searchPhrase(value, index) ||
        searchWord(value, index);
}

export function searchNotExpr(value: number[] | Uint8Array, index: number): Lexer.Token {
    let rws = Lexer.RWS(value, index);
    if (!Utils.equals(value, rws, "NOT")) return;
    let start = index;
    index = rws + 3;
    rws = Lexer.RWS(value, index);
    if (rws === index) return;
    index = rws;
    let expr = searchPhrase(value, index) ||
        searchWord(value, index);
    if (!expr) return;
    index = expr.next;

    return Lexer.tokenize(value, start, index, expr, Lexer.TokenType.SearchNotExpression);
}

export function searchOrExpr(value: number[] | Uint8Array, index: number): Lexer.Token {
    let rws = Lexer.RWS(value, index);
    if (rws === index || !Utils.equals(value, rws, "OR")) return;
    let start = index;
    index = rws + 2;
    rws = Lexer.RWS(value, index);
    if (rws === index) return;
    index = rws;
    let token = searchExpr(value, index);
    if (!token) return;
    index = token.next;

    return Lexer.tokenize(value, start, index, token, Lexer.TokenType.SearchOrExpression);
}

export function searchAndExpr(value: number[] | Uint8Array, index: number): Lexer.Token {
    let rws = Lexer.RWS(value, index);
    if (rws === index || !Utils.equals(value, rws, "AND")) return;
    let start = index;
    index = rws + 3;
    rws = Lexer.RWS(value, index);
    if (rws === index) return;
    index = rws;
    let token = searchExpr(value, index);
    if (!token) return;
    index = token.next;

    return Lexer.tokenize(value, start, index, token, Lexer.TokenType.SearchAndExpression);
}

export function searchPhrase(value: number[] | Uint8Array, index: number): Lexer.Token {
    let mark = Lexer.quotationMark(value, index);
    if (!mark) return;
    let start = index;
    index = mark;

    let valueStart = index;
    let ch = Lexer.qcharNoAMPDQUOTE(value, index);
    while (ch > index && !Lexer.OPEN(value, index) && !Lexer.CLOSE(value, index)) {
        index = ch;
        ch = Lexer.qcharNoAMPDQUOTE(value, index);
    }
    let valueEnd = index;

    mark = Lexer.quotationMark(value, index);
    if (!mark) return;
    index = mark;

    return Lexer.tokenize(value, start, index, Utils.stringify(value, valueStart, valueEnd), Lexer.TokenType.SearchPhrase);
}

export function searchWord(value: number[] | Uint8Array, index: number): Lexer.Token {
    let next = Utils.required(value, index, Lexer.ALPHA, 1);
    if (!next) return;
    let start = index;
    index = next;

    let token = Lexer.tokenize(value, start, index, null, Lexer.TokenType.SearchWord);
    token.value = token.raw;
    return token;
}

export function searchParenExpr(value: number[] | Uint8Array, index: number): Lexer.Token {
    let open = Lexer.OPEN(value, index);
    if (!open) return;
    let start = index;
    index = open;
    index = Lexer.BWS(value, index);

    let expr = searchExpr(value, index);
    if (!expr) return;
    index = expr.next;

    index = Lexer.BWS(value, index);
    let close = Lexer.CLOSE(value, index);
    if (!close) return;
    index = close;

    return Lexer.tokenize(value, start, index, expr, Lexer.TokenType.SearchParenExpression);
}

export function levels(value: number[] | Uint8Array, index: number): Lexer.Token {
    let start = index;
    if (Utils.equals(value, index, "%24levels")) {
        index += 9;
    }else
    if (Utils.equals(value, index, "$levels")) {
        index += 7;
    }else return;

    let eq = Lexer.EQ(value, index);
    if (!eq) return;
    index = eq;

    let level;
    if (Utils.equals(value, index, "max")) {
        level = "max";
        index += 3;
    } else {
        let token = PrimitiveLiteral.int32Value(value, index);
        if (!token) return;
        level = token.raw;
        index = token.next;
    }

    return Lexer.tokenize(value, start, index, level, Lexer.TokenType.Levels);
}

export function filter(value: number[] | Uint8Array, index: number): Lexer.Token {
    let start = index;
    if (Utils.equals(value, index, "%24filter")) {
        index += 9;
    }else
    if (Utils.equals(value, index, "$filter")) {
        index += 7;
    }else return;

    let eq = Lexer.EQ(value, index);
    if (!eq) return;
    index = eq;

    let expr = Expressions.boolCommonExpr(value, index);
    if (!expr) return;
    index = expr.next;

    return Lexer.tokenize(value, start, index, expr, Lexer.TokenType.Filter);
}

export function orderby(value: number[] | Uint8Array, index: number): Lexer.Token {
    let start = index;
    if (Utils.equals(value, index, "%24orderby")) {
        index += 10;
    }else
    if (Utils.equals(value, index, "$orderby")) {
        index += 8;
    }else return;

    let eq = Lexer.EQ(value, index);
    if (!eq) return;
    index = eq;

    let items = [];
    let token = orderbyItem(value, index);
    if (!token) return;
    index = token.next;

    while (token) {
        items.push(token);

        let comma = Lexer.COMMA(value, index);
        if (comma) {
            index = comma;
            let token = orderbyItem(value, index);
            if (!token) return;
            index = token.next;
        }else break;
    }

    return Lexer.tokenize(value, start, index, { items }, Lexer.TokenType.OrderBy);
}

export function orderbyItem(value: number[] | Uint8Array, index: number): Lexer.Token {
    let expr = Expressions.commonExpr(value, index);
    if (!expr) return;
    let start = index;
    index = expr.next;

    let direction = 1;
    let rws = Lexer.RWS(value, index);
    if (rws > index) {
        index = rws;
        if (Utils.equals(value, index, "asc")) index += 3;
        else if (Utils.equals(value, index, "desc")) {
            index += 4;
            direction = -1;
        }else return;
    }

    return Lexer.tokenize(value, start, index, { expr, direction }, Lexer.TokenType.OrderByItem);
}

export function skip(value: number[] | Uint8Array, index: number): Lexer.Token {
    let start = index;
    if (Utils.equals(value, index, "%24skip")) {
        index += 7;
    }else
    if (Utils.equals(value, index, "$skip")) {
        index += 5;
    }else return;

    let eq = Lexer.EQ(value, index);
    if (!eq) return;
    index = eq;

    let token = PrimitiveLiteral.int32Value(value, index);
    if (!token) return;
    index = token.next;

    return Lexer.tokenize(value, start, index, token, Lexer.TokenType.Skip);
}

export function top(value: number[] | Uint8Array, index: number): Lexer.Token {
    let start = index;
    if (Utils.equals(value, index, "%24top")) {
        index += 6;
    }else
    if (Utils.equals(value, index, "$top")) {
        index += 4;
    }else return;

    let eq = Lexer.EQ(value, index);
    if (!eq) return;
    index = eq;

    let token = PrimitiveLiteral.int32Value(value, index);
    if (!token) return;
    index = token.next;

    return Lexer.tokenize(value, start, index, token, Lexer.TokenType.Top);
}

export function format(value: number[] | Uint8Array, index: number): Lexer.Token {
    let start = index;
    if (Utils.equals(value, index, "%24format")) {
        index += 9;
    }else
    if (Utils.equals(value, index, "$format")) {
        index += 7;
    }else return;

    let eq = Lexer.EQ(value, index);
    if (!eq) return;
    index = eq;

    let format;
    if (Utils.equals(value, index, "atom")) {
        format = "atom";
        index += 4;
    }else if (Utils.equals(value, index, "json")) {
        format = "json";
        index += 4;
    }else if (Utils.equals(value, index, "xml")) {
        format = "xml";
        index += 3;
    }

    if (format) return Lexer.tokenize(value, start, index, { format }, Lexer.TokenType.Format);
}

export function inlinecount(value: number[] | Uint8Array, index: number): Lexer.Token {
    let start = index;
    if (Utils.equals(value, index, "%24count")) {
        index += 8;
    }else
    if (Utils.equals(value, index, "$count")) {
        index += 6;
    }else return;

    let eq = Lexer.EQ(value, index);
    if (!eq) return;
    index = eq;

    let token = PrimitiveLiteral.booleanValue(value, index);
    if (!token) return;
    index = token.next;

    return Lexer.tokenize(value, start, index, token, Lexer.TokenType.InlineCount);
}

export function select(value: number[] | Uint8Array, index: number): Lexer.Token {
    let start = index;
    if (Utils.equals(value, index, "%24select")) {
        index += 9;
    }else
    if (Utils.equals(value, index, "$select")) {
        index += 7;
    }else return;

    let eq = Lexer.EQ(value, index);
    if (!eq) return;
    index = eq;

    let items = [];
    let token = selectItem(value, index);
    if (!token) return;
    while (token) {
        items.push(token);
        index = token.next;

        let comma = Lexer.COMMA(value, index);
        if (comma) {
            index = comma;
            token = selectItem(value, index);
            if (!token) return;
        }else break;
    }

    return Lexer.tokenize(value, start, index, { items }, Lexer.TokenType.Select);
}

export function selectItem(value: number[] | Uint8Array, index: number): Lexer.Token {
    let start = index;
    let item;
    let op = allOperationsInSchema(value, index);
    let star = Lexer.STAR(value, index);
    if (op > index) {
        item = { namespace: Utils.stringify(value, index, op - 2), value: "*" };
        index = op;
    }else if (star) {
        item = { value: "*" };
        index = star;
    } else {
        item = {};
        let name = NameOrIdentifier.qualifiedEntityTypeName(value, index) ||
            NameOrIdentifier.qualifiedComplexTypeName(value, index);

        if (name && value[name.next] !== 0x2f) return;
        else if (name && value[name.next] === 0x2f) {
            index++;
            item.name = name;
        }

        let select = selectProperty(value, index) ||
            qualifiedActionName(value, index) ||
            qualifiedFunctionName(value, index);
        if (!select) return;
        index = select.next;

        item = name ? { name, select } : select;
    }

    if (index > start) return Lexer.tokenize(value, start, index, item, Lexer.TokenType.SelectItem);
}

export function allOperationsInSchema(value: number[] | Uint8Array, index: number): number {
    let namespaceNext = NameOrIdentifier.namespace(value, index);
    let star = Lexer.STAR(value, namespaceNext + 1);
    if (namespaceNext > index && value[namespaceNext] === 0x2e && star) return star;
    return index;
}

export function selectProperty(value: number[] | Uint8Array, index: number): Lexer.Token {
    let token = selectPath(value, index) ||
        NameOrIdentifier.primitiveProperty(value, index) ||
        NameOrIdentifier.primitiveColProperty(value, index) ||
        NameOrIdentifier.navigationProperty(value, index);
    if (!token) return;
    let start = index;
    index = token.next;

    if (token.type === Lexer.TokenType.SelectPath) {
        if (value[index] === 0x2f) {
            index++;
            let prop = selectProperty(value, index);

            if (!prop) return;
            let path = Lexer.clone(token);
            token.next = prop.next;
            token.raw = Utils.stringify(value, start, token.next);
            token.value = { path, next: prop };
        }
    }

    return token;
}

export function selectPath(value: number[] | Uint8Array, index: number): Lexer.Token {
    let token = NameOrIdentifier.complexProperty(value, index) ||
        NameOrIdentifier.complexColProperty(value, index);

    if (!token) return;
    let start = index;
    index = token.next;

    let tokenValue: any = token;
    if (value[index] === 0x2f) {
        let name = NameOrIdentifier.qualifiedComplexTypeName(value, index + 1);
        if (name) {
            index = name.next;
            tokenValue = { prop: token, name };
        }
    }

    return Lexer.tokenize(value, start, index, tokenValue, Lexer.TokenType.SelectPath);
}

export function qualifiedActionName(value: number[] | Uint8Array, index: number): Lexer.Token {
    let namespaceNext = NameOrIdentifier.namespace(value, index);
    if (namespaceNext === index || value[namespaceNext] !== 0x2e) return;
    let start = index;
    index = namespaceNext + 1;

    let action = NameOrIdentifier.action(value, index);
    if (!action) return;
    action.value.namespace = Utils.stringify(value, start, namespaceNext);

    return Lexer.tokenize(value, start, action.next, action, Lexer.TokenType.Action);
}

export function qualifiedFunctionName(value: number[] | Uint8Array, index: number): Lexer.Token {
    let namespaceNext = NameOrIdentifier.namespace(value, index);
    if (namespaceNext === index || value[namespaceNext] !== 0x2e) return;
    let start = index;
    index = namespaceNext + 1;

    let fn = NameOrIdentifier.odataFunction(value, index);
    if (!fn) return;
    fn.value.namespace = Utils.stringify(value, start, namespaceNext);
    index = fn.next;
    let tokenValue: any = { name: fn };

    let open = Lexer.OPEN(value, index);
    if (open) {
        index = open;
        tokenValue.parameters = [];
        let param = Expressions.parameterName(value, index);
        if (!param) return;

        while (param) {
            index = param.next;
            tokenValue.parameters.push(param);

            let comma = Lexer.COMMA(value, index);
            if (comma) {
                index = comma;
                let param = Expressions.parameterName(value, index);
                if (!param) return;
            }else break;
        }

        let close = Lexer.CLOSE(value, index);
        if (!close) return;
        index = close;
    }

    return Lexer.tokenize(value, start, index, tokenValue, Lexer.TokenType.Function);
}

export function skiptoken(value: number[] | Uint8Array, index: number): Lexer.Token {
    let start = index;
    if (Utils.equals(value, index, "%24skiptoken")) {
        index += 12;
    }else
    if (Utils.equals(value, index, "$skiptoken")) {
        index += 10;
    }else return;

    let eq = Lexer.EQ(value, index);
    if (!eq) return;
    index = eq;

    let ch = Lexer.qcharNoAMP(value, index);
    if (!ch) return;
    let valueStart = index;

    while (ch > index) {
        index = ch;
        ch = Lexer.qcharNoAMP(value, index);
    }

    return Lexer.tokenize(value, start, index, Utils.stringify(value, valueStart, index), Lexer.TokenType.SkipToken);
}

export function aliasAndValue(value: number[] | Uint8Array, index: number): Lexer.Token {
    let alias = Expressions.parameterAlias(value, index);
    if (!alias) return;
    let start = index;
    index = alias.next;

    let eq = Lexer.EQ(value, index);
    if (!eq) return;
    index = eq;

    let paramValue = Expressions.parameterValue(value, index);
    if (!paramValue) return;
    index = paramValue.next;

    return Lexer.tokenize(value, start, index, {
        alias,
        value: paramValue
    }, Lexer.TokenType.AliasAndValue);
}
