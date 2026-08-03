package office

import (
	"os"
	"path/filepath"
	"testing"
)

// TestWriteExternalFixtures is opt-in so ordinary unit tests remain hermetic.
// CI sets NORTHWING_OFFICE_FIXTURE_DIR and opens the results with independent
// Office parsers rather than trusting Northwing's own validator.
func TestWriteExternalFixtures(t *testing.T) {
	dir := os.Getenv("NORTHWING_OFFICE_FIXTURE_DIR")
	if dir == "" {
		t.Skip("NORTHWING_OFFICE_FIXTURE_DIR is not set")
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := CreateDOCX(filepath.Join(dir, "northwing.docx"), "Northwing Report", []Section{{Heading: "Summary", Paragraphs: []string{"Verified document body."}}}, ""); err != nil {
		t.Fatal(err)
	}
	if err := CreatePPTX(filepath.Join(dir, "northwing.pptx"), "Northwing Deck", []Slide{{Title: "First slide", Bullets: []string{"Verified bullet"}}, {Title: "Second slide", Bullets: []string{"Another point"}}}); err != nil {
		t.Fatal(err)
	}
	if err := CreateXLSX(filepath.Join(dir, "northwing.xlsx"), []Sheet{{Name: "Data", Rows: [][]any{{"Name", "Value"}, {"Alpha", 42}}}}); err != nil {
		t.Fatal(err)
	}
	if err := CreatePDF(filepath.Join(dir, "northwing.pdf"), "Northwing PDF", "Verified searchable body."); err != nil {
		t.Fatal(err)
	}
}
