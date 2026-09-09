#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
images_dir="$repo_dir/docs/images"
output_path="${1:-$images_dir/youtuber-ai-linkedin-square-scripted.png}"
work_dir="$(mktemp -d "${TMPDIR:-/tmp}/youtuber-ai-social.XXXXXX")"

cleanup() {
  rm -rf "$work_dir"
}
trap cleanup EXIT

if ! command -v magick >/dev/null 2>&1; then
  echo "ImageMagick is required (missing 'magick' command)." >&2
  exit 1
fi

dashboard_back="$images_dir/dashboard.png"
generation_main="$images_dir/generation.png"
script_front="$images_dir/script-result.png"
youtuber_logo="$repo_dir/public/img/logo.svg"

for source_image in "$dashboard_back" "$generation_main" "$script_front" "$youtuber_logo"; do
  if [[ ! -f "$source_image" ]]; then
    echo "Missing source image: $source_image" >&2
    exit 1
  fi
done

make_rounded_card() {
  local source_image="$1"
  local target_image="$2"
  local width="$3"
  local height="$4"
  local radius="$5"
  local border_color="$6"
  local border_width="$7"

  magick "$source_image" -filter Lanczos -resize "${width}x${height}!" -alpha on "(" -size "${width}x${height}" xc:none -fill white -draw "roundrectangle 0,0 $((width - 1)),$((height - 1)) $radius,$radius" ")" -compose CopyOpacity -composite -compose over -stroke "$border_color" -strokewidth "$border_width" -fill none -draw "roundrectangle $((border_width / 2)),$((border_width / 2)) $((width - 1 - border_width / 2)),$((height - 1 - border_width / 2)) $radius,$radius" "$target_image"
}

# The three cards tell the core product story: workspace, generation brief,
# and the resulting production-ready script.
make_rounded_card "$dashboard_back" "$work_dir/dashboard-card.png" 1080 750 24 '#596178' 2
make_rounded_card "$generation_main" "$work_dir/generation-card.png" 1220 847 28 '#7770ff' 3
make_rounded_card "$script_front" "$work_dir/script-card.png" 700 486 26 '#747cf8' 3

magick -background none -density 600 "$youtuber_logo" -filter Lanczos -resize 150x150! -alpha on "(" -size 150x150 xc:none -fill white -draw 'roundrectangle 0,0 149,149 22,22' ")" -compose CopyOpacity -composite "$work_dir/logo-card.png"

# Dark navy base with restrained violet and cyan light pools derived from the
# Youtuber AI interface. The glows keep the composition dimensional without
# competing with the product screens.
magick -size 1600x1600 gradient:'#0b1027-#03050e' -rotate 90 "$work_dir/base.png"
magick -size 400x400 xc:none -fill 'rgba(91,70,255,0.32)' -draw 'circle 45,82 142,82' -blur 0x42 -resize 1600x1600 "$work_dir/violet-glow.png"
magick -size 400x400 xc:none -fill 'rgba(16,190,220,0.18)' -draw 'circle 360,292 278,292' -blur 0x48 -resize 1600x1600 "$work_dir/cyan-glow.png"

magick "$work_dir/base.png" "$work_dir/violet-glow.png" -compose over -composite "$work_dir/cyan-glow.png" -compose over -composite -fill 'rgba(0,0,0,0.48)' -stroke none -draw 'roundrectangle 500,180 1590,940 28,28' -draw 'roundrectangle 115,470 1355,1335 32,32' -draw 'roundrectangle 870,885 1595,1395 30,30' -fill 'rgba(0,0,0,0.34)' -draw 'roundrectangle 104,104 274,274 44,44' "$work_dir/logo-card.png" -geometry +114+114 -compose over -composite "$work_dir/dashboard-card.png" -geometry +500+155 -compose over -composite "$work_dir/generation-card.png" -geometry +105+455 -compose over -composite "$work_dir/script-card.png" -geometry +885+875 -compose over -composite -colorspace sRGB -strip -quality 94 "$output_path"

echo "Created $output_path"
