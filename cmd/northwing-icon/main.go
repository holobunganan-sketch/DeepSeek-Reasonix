// Command northwing-icon deterministically generates Northwing PNG and ICO
// resources without checking opaque binary blobs into the repository.
package main

import (
	"bytes"
	"encoding/binary"
	"flag"
	"image"
	"image/color"
	"image/png"
	"log"
	"math"
	"os"
	"path/filepath"
	"sort"
)

var root = flag.String("root", ".", "repository root")

func main() {
	flag.Parse()
	pngPath := filepath.Join(*root, "desktop", "build", "appicon.png")
	icoPath := filepath.Join(*root, "desktop", "build", "windows", "icon.ico")
	if err := os.MkdirAll(filepath.Dir(icoPath), 0o755); err != nil {
		log.Fatal(err)
	}
	if err := writePNG(pngPath, icon(1024)); err != nil {
		log.Fatal(err)
	}
	if err := writeICO(icoPath, []int{16, 24, 32, 48, 64, 128, 256}); err != nil {
		log.Fatal(err)
	}
}

func icon(size int) *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, size, size))
	bg := color.RGBA{R: 12, G: 18, B: 34, A: 255}
	blue := color.RGBA{R: 37, G: 99, B: 235, A: 255}
	white := color.RGBA{R: 255, G: 255, B: 255, A: 255}
	border := color.RGBA{R: 67, G: 112, B: 255, A: 220}

	fillRounded(img, int(.035*float64(size)), int(.19*float64(size)), bg)
	strokeRounded(img, int(.035*float64(size)), int(.19*float64(size)), max(1, size/80), border)

	wing := []image.Point{
		pt(size, .17, .68), pt(size, .39, .63), pt(size, .59, .46), pt(size, .78, .22),
		pt(size, .71, .47), pt(size, .86, .57), pt(size, .62, .60), pt(size, .49, .52), pt(size, .37, .69),
	}
	fillPolygon(img, wing, blue)
	thickLine(img, pt(size, .20, .72), pt(size, .44, .33), max(2, size/18), white)
	thickLine(img, pt(size, .44, .33), pt(size, .62, .66), max(2, size/18), white)
	thickLine(img, pt(size, .62, .66), pt(size, .82, .28), max(2, size/18), white)
	for _, segment := range [][2]image.Point{
		{pt(size, .26, .64), pt(size, .72, .28)},
		{pt(size, .36, .66), pt(size, .76, .39)},
		{pt(size, .45, .68), pt(size, .78, .53)},
	} {
		thickLine(img, segment[0], segment[1], max(1, size/38), white)
	}
	return img
}

func writePNG(path string, img image.Image) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	var data bytes.Buffer
	if err := png.Encode(&data, img); err != nil {
		return err
	}
	return os.WriteFile(path, data.Bytes(), 0o644)
}

func writeICO(path string, sizes []int) error {
	type frame struct {
		size int
		data []byte
	}
	frames := make([]frame, 0, len(sizes))
	for _, size := range sizes {
		var data bytes.Buffer
		if err := png.Encode(&data, icon(size)); err != nil {
			return err
		}
		frames = append(frames, frame{size: size, data: data.Bytes()})
	}
	var out bytes.Buffer
	_ = binary.Write(&out, binary.LittleEndian, uint16(0))
	_ = binary.Write(&out, binary.LittleEndian, uint16(1))
	_ = binary.Write(&out, binary.LittleEndian, uint16(len(frames)))
	offset := 6 + 16*len(frames)
	for _, frame := range frames {
		width, height := byte(frame.size), byte(frame.size)
		if frame.size >= 256 {
			width, height = 0, 0
		}
		out.WriteByte(width)
		out.WriteByte(height)
		out.WriteByte(0)
		out.WriteByte(0)
		_ = binary.Write(&out, binary.LittleEndian, uint16(1))
		_ = binary.Write(&out, binary.LittleEndian, uint16(32))
		_ = binary.Write(&out, binary.LittleEndian, uint32(len(frame.data)))
		_ = binary.Write(&out, binary.LittleEndian, uint32(offset))
		offset += len(frame.data)
	}
	for _, frame := range frames {
		out.Write(frame.data)
	}
	return os.WriteFile(path, out.Bytes(), 0o644)
}

func pt(size int, x, y float64) image.Point {
	return image.Pt(int(x*float64(size)), int(y*float64(size)))
}

func fillRounded(img *image.RGBA, inset, radius int, c color.RGBA) {
	bounds := img.Bounds().Inset(inset)
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			if roundedContains(bounds, radius, x, y) {
				img.SetRGBA(x, y, c)
			}
		}
	}
}

func strokeRounded(img *image.RGBA, inset, radius, width int, c color.RGBA) {
	outer := img.Bounds().Inset(inset)
	inner := outer.Inset(width)
	for y := outer.Min.Y; y < outer.Max.Y; y++ {
		for x := outer.Min.X; x < outer.Max.X; x++ {
			if roundedContains(outer, radius, x, y) && !roundedContains(inner, max(0, radius-width), x, y) {
				img.SetRGBA(x, y, c)
			}
		}
	}
}

func roundedContains(r image.Rectangle, radius, x, y int) bool {
	if !image.Pt(x, y).In(r) {
		return false
	}
	cx := clamp(x, r.Min.X+radius, r.Max.X-radius-1)
	cy := clamp(y, r.Min.Y+radius, r.Max.Y-radius-1)
	dx, dy := x-cx, y-cy
	return dx*dx+dy*dy <= radius*radius
}

func fillPolygon(img *image.RGBA, points []image.Point, c color.RGBA) {
	if len(points) < 3 {
		return
	}
	minY, maxY := points[0].Y, points[0].Y
	for _, p := range points[1:] {
		minY, maxY = min(minY, p.Y), max(maxY, p.Y)
	}
	for y := minY; y <= maxY; y++ {
		var xs []int
		for i, a := range points {
			b := points[(i+1)%len(points)]
			if (a.Y <= y && b.Y > y) || (b.Y <= y && a.Y > y) {
				x := a.X + (y-a.Y)*(b.X-a.X)/(b.Y-a.Y)
				xs = append(xs, x)
			}
		}
		sort.Ints(xs)
		for i := 0; i+1 < len(xs); i += 2 {
			for x := xs[i]; x <= xs[i+1]; x++ {
				if image.Pt(x, y).In(img.Bounds()) {
					img.SetRGBA(x, y, c)
				}
			}
		}
	}
}

func thickLine(img *image.RGBA, a, b image.Point, width int, c color.RGBA) {
	steps := max(abs(b.X-a.X), abs(b.Y-a.Y))
	if steps == 0 {
		circle(img, a, width/2, c)
		return
	}
	for i := 0; i <= steps; i++ {
		x := a.X + (b.X-a.X)*i/steps
		y := a.Y + (b.Y-a.Y)*i/steps
		circle(img, image.Pt(x, y), width/2, c)
	}
}

func circle(img *image.RGBA, center image.Point, radius int, c color.RGBA) {
	for y := center.Y - radius; y <= center.Y+radius; y++ {
		for x := center.X - radius; x <= center.X+radius; x++ {
			if (x-center.X)*(x-center.X)+(y-center.Y)*(y-center.Y) <= radius*radius && image.Pt(x, y).In(img.Bounds()) {
				img.SetRGBA(x, y, c)
			}
		}
}

func clamp(v, lo, hi int) int {
	return int(math.Max(float64(lo), math.Min(float64(hi), float64(v))))
}

func abs(v int) int {
	if v < 0 {
		return -v
	}
	return v
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
