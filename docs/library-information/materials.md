# Materials

This document lists all materials (colors) from the Furniture_Smith library.

## Source

Data extracted from `HiPlanContext.masterData.Furniture_Smith.attributes` where type is Text and name/desc contains "Color".

## Thumbnails

The thumbnails are the swatches the planner shows for a color attribute (e.g. FRONT COLOR). They are stored in [`images/materials/`](./images/materials/), downloaded from the `mod_FrontColor` selections of the Furniture_Smith master data.

In the HI master data every attribute selection carries an `imageUrl`, a read-only SAS URL of a blob on the HOMAG TecConfig CDN:

```
https://tecconfig-preview.homag.cloud/cdn/{subscription_id}/library/furniture_smith/images/{image_guid}_{file_name}?sv=...&st=...&se=...&sr=b&sp=r&sig=...
```

- `{subscription_id}` = `e2fe8b3d-da31-4a20-92ab-ab6e3839300e`
- `{image_guid}` is random per image, so the URL cannot be built from the material value
- The signature is bound to the exact blob; without it the CDN answers `409 PublicAccessNotPermitted`
- The signature is valid for about a month (`st` to `se`), so a download needs a fresh master data response

`get-plan-context` leaves the selection `imageUrl`s out of its compact masterData, so `hi-plan-context.json` does not contain them. The download process is described in [hi-furniture-smith-materials.md](../../.agents/skills/hi-furniture-smith-materials.md).

## Materials

| Name | Value | Thumbnail |
|---|---|---|
| Cloudy blue | 152 | ![Cloudy blue](images/materials/152.png) |
| Denim blue | 155 | ![Denim blue](images/materials/155.png) |
| Olive green | 160 | ![Olive green](images/materials/160.png) |
| Seaweed green | 165 | ![Seaweed green](images/materials/165.png) |
| Light grey | 178 | ![Light grey](images/materials/178.png) |
| Sunny white | 190 | ![Sunny white](images/materials/190.png) |
| Snow white | 192 | ![Snow white](images/materials/192.png) |
| Jet black | 199 | ![Jet black](images/materials/199.png) |
| Dark walnut | 214 | ![Dark walnut](images/materials/214.png) |
| Walnut | 215 | ![Walnut](images/materials/215.png) |
| Tiepolo walnut | 216 | ![Tiepolo walnut](images/materials/216.png) |
| Oak | 222 | ![Oak](images/materials/222.png) |
| Bijoux oak | 224 | ![Bijoux oak](images/materials/224.png) |
| Dark oak | 229 | ![Dark oak](images/materials/229.png) |
| Maple | 230 | ![Maple](images/materials/230.png) |
| Ash grey | 240 | ![Ash grey](images/materials/240.png) |
| Ponderosa pine | 250 | ![Ponderosa pine](images/materials/250.png) |
| Concrete | 316 | ![Concrete](images/materials/316.png) |
| Dark marble | 324 | ![Dark marble](images/materials/324.png) |
| Slate | 326 | ![Slate](images/materials/326.png) |
| Marble | 380 | ![Marble](images/materials/380.png) |
