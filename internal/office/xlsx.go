package office

import (
	"fmt"
	"strconv"
	"strings"
)

func CreateXLSX(path string, sheets []Sheet) error {
	if err := extRequired(path, ".xlsx"); err != nil {
		return err
	}
	if len(sheets) == 0 {
		sheets = []Sheet{{Name: "Sheet1"}}
	}
	files := map[string][]byte{}
	var ovs, book, rels strings.Builder
	seen := map[string]int{}
	for i, s := range sheets {
		n := i + 1
		name := uniqueSheetName(s.Name, n, seen)
		fmt.Fprintf(&ovs, `<Override PartName="/xl/worksheets/sheet%d.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`, n)
		fmt.Fprintf(&book, `<sheet name="%s" sheetId="%d" r:id="rId%d"/>`, xmlEsc(name), n, n)
		fmt.Fprintf(&rels, `<Relationship Id="rId%d" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet%d.xml"/>`, n, n)
		files[fmt.Sprintf("xl/worksheets/sheet%d.xml", n)] = []byte(sheetXML(s.Rows))
	}
	files["[Content_Types].xml"] = []byte(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` + ovs.String() + `</Types>`)
	files["_rels/.rels"] = []byte(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`)
	files["xl/workbook.xml"] = []byte(`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>` + book.String() + `</sheets></workbook>`)
	files["xl/_rels/workbook.xml.rels"] = []byte(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` + rels.String() + `<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`)
	files["xl/styles.xml"] = []byte(`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="11"/><name val="Aptos"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf xfId="0"/><xf xfId="0" fontId="1" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`)
	return writeZip(path, files)
}

func sheetXML(rows [][]any) string {
	var b strings.Builder
	b.WriteString(`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>`)
	for r, row := range rows {
		fmt.Fprintf(&b, `<row r="%d">`, r+1)
		for c, v := range row {
			ref := columnName(c+1) + strconv.Itoa(r+1)
			style := ""
			if r == 0 {
				style = ` s="1"`
			}
			switch x := v.(type) {
			case nil:
			case bool:
				bv := "0"
				if x {
					bv = "1"
				}
				b.WriteString(`<c r="` + ref + `" t="b"` + style + `><v>` + bv + `</v></c>`)
			case int:
				b.WriteString(`<c r="` + ref + `"` + style + `><v>` + strconv.Itoa(x) + `</v></c>`)
			case int64:
				b.WriteString(`<c r="` + ref + `"` + style + `><v>` + strconv.FormatInt(x, 10) + `</v></c>`)
			case float64:
				b.WriteString(`<c r="` + ref + `"` + style + `><v>` + strconv.FormatFloat(x, 'g', -1, 64) + `</v></c>`)
			default:
				b.WriteString(`<c r="` + ref + `" t="inlineStr"` + style + `><is><t xml:space="preserve">` + xmlEsc(fmt.Sprint(x)) + `</t></is></c>`)
			}
		}
		b.WriteString(`</row>`)
	}
	b.WriteString(`</sheetData>`)
	if len(rows) > 0 && len(rows[0]) > 0 {
		b.WriteString(`<autoFilter ref="A1:` + columnName(len(rows[0])) + strconv.Itoa(len(rows)) + `"/>`)
	}
	b.WriteString(`</worksheet>`)
	return b.String()
}

func uniqueSheetName(name string, index int, seen map[string]int) string {
	name = strings.TrimSpace(name)
	if name == "" {
		name = fmt.Sprintf("Sheet%d", index)
	}
	name = strings.Map(func(r rune) rune {
		if strings.ContainsRune(`:\/?*[]`, r) {
			return '-'
		}
		return r
	}, name)
	rs := []rune(name)
	if len(rs) > 31 {
		name = string(rs[:31])
	}
	base := name
	seen[base]++
	if seen[base] > 1 {
		s := fmt.Sprintf("-%d", seen[base])
		rr := []rune(base)
		if len(rr) > 31-len([]rune(s)) {
			rr = rr[:31-len([]rune(s))]
		}
		name = string(rr) + s
	}
	return name
}

func columnName(n int) string {
	var out []byte
	for n > 0 {
		n--
		out = append([]byte{byte('A' + n%26)}, out...)
		n /= 26
	}
	if len(out) == 0 {
		return "A"
	}
	return string(out)
}
