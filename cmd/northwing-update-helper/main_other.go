//go:build !windows

package main

import "fmt"

func main() {
	fmt.Println("northwing-update-helper is available on Windows only")
}
