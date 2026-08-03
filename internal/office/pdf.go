package office

import (
	"bytes"
	"encoding/hex"
	"fmt"
	"strings"
	"unicode/utf16"
)

func CreatePDF(path, title, text string) error {
	if err := extRequired(path, ".pdf"); err != nil {
		return err
	}
	lines := wrapText(strings.TrimSpace(title+"\n"+text), 46)
	if len(lines) == 0 {
		lines = []string{" "}
	}
	const per = 38
	pages := (len(lines) + per - 1) / per
	objects := map[int][]byte{}
	kids := make([]string, pages)
	for i := 0; i < pages; i++ {
		pageObj := 5 + i*2
		contentObj := pageObj + 1
		kids[i] = fmt.Sprintf("%d 0 R", pageObj)
		chunk := lines[i*per : min(len(lines), (i+1)*per)]
		stream := pdfContent(chunk)
		objects[pageObj] = []byte(fmt.Sprintf(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents %d 0 R >>`, contentObj))
		objects[contentObj] = []byte(fmt.Sprintf("<< /Length %d >>\nstream\n%s\nendstream", len(stream), stream))
	}
	objects[1] = []byte(`<< /Type /Catalog /Pages 2 0 R >>`)
	objects[2] = []byte(`<< /Type /Pages /Kids [` + strings.Join(kids, " ") + `] /Count ` + fmt.Sprint(pages) + ` >>`)
	objects[3] = []byte(`<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [4 0 R] >>`)
	objects[4] = []byte(`<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 4 >> >>`)
	var b bytes.Buffer
	b.WriteString("%PDF-1.7\n%\xE2\xE3\xCF\xD3\n")
	max := 4 + pages*2
	offs := make([]int, max+1)
	for i := 1; i <= max; i++ {
		offs[i] = b.Len()
		fmt.Fprintf(&b, "%d 0 obj\n", i)
		b.Write(objects[i])
		b.WriteString("\nendobj\n")
	}
	xref := b.Len()
	fmt.Fprintf(&b, "xref\n0 %d\n0000000000 65535 f \n", max+1)
	for i := 1; i <= max; i++ {
		fmt.Fprintf(&b, "%010d 00000 n \n", offs[i])
	}
	fmt.Fprintf(&b, "trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n", max+1, xref)
	return writeAtomic(path, b.Bytes())
}

func pdfContent(lines []string) string {
	var b strings.Builder
	b.WriteString("BT\n/F1 13 Tf\n48 790 Td\n18 TL\n")
	for i, s := range lines {
		if i > 0 {
			b.WriteString("T*\n")
		}
		b.WriteString("<" + utf16Hex(s) + "> Tj\n")
	}
	b.WriteString("ET")
	return b.String()
}

func utf16Hex(s string) string {
	u := utf16.Encode([]rune(s))
	buf := make([]byte, 2+2*len(u))
	buf[0] = 0xfe
	buf[1] = 0xff
	for i, x := range u {
		buf[2+i*2] = byte(x >> 8)
		buf[3+i*2] = byte(x)
	}
	return strings.ToUpper(hex.EncodeToString(buf))
}

func wrapText(text string, width int) []string {
	var out []string
	for _, p := range strings.Split(strings.ReplaceAll(text, "\r\n", "\n"), "\n") {
		r := []rune(p)
		if len(r) == 0 {
			out = append(out, "")
			continue
		}
		for len(r) > width {
			cut := width
			for i := width; i > width/2; i-- {
				if strings.ContainsRune(" ，。,." , r[i-1]) {
					cut = i
					break
				}
			}
			out = append(out, strings.TrimSpace(string(r[:cut])))
			r = r[cut:]
		}
		out = append(out, strings.TrimSpace(string(r)))
	}
	return out
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
