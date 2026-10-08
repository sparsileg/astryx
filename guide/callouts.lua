-- Turns fenced divs into the callout boxes defined in guide.typ:
--   ::: tip       Astryx Tip
--   ::: why       Why this matters
--   ::: note      Note
--   ::: shot      Screenshot placeholder, saying what the picture will show.
--                 Give each an id ({.shot id="manage-locations"}) naming the
--                 image that will replace it: images/<id>.png
-- A title="..." attribute replaces the default heading.
local kinds = { tip = true, why = true, note = true, shot = true }

function Div(div)
  for _, class in ipairs(div.classes) do
    if kinds[class] then
      local title = div.attributes.title
      local args = '"' .. class .. '"'
      if title then
        args = args .. ', title: "' .. title:gsub('\\', '\\\\'):gsub('"', '\\"') .. '"'
      end
      local blocks = pandoc.List({ pandoc.RawBlock('typst', '#callout(' .. args .. ')[') })
      blocks:extend(div.content)
      blocks:insert(pandoc.RawBlock('typst', ']'))
      return blocks
    end
  end
end
