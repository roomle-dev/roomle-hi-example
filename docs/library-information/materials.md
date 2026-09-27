# Materials

This document lists all materials (colors) from the Furniture_Smith library.

## Source

Data extracted from `HiPlanContext.masterData.Furniture_Smith.attributes` where type is Text and name/desc contains "Color".

## Thumbnails

The thumbnails are the swatches the planner shows for a color attribute (e.g. FRONT COLOR): the `imageUrl` of each selection in `hi-plan-context.json`, a read-only SAS URL of a blob on the HOMAG TecConfig CDN:

```
https://tecconfig-preview.homag.cloud/cdn/{subscription_id}/library/furniture_smith/images/{image_guid}_{file_name}?sv=...&st=...&se=...&sr=b&sp=r&sig=...
```

- `{subscription_id}` = `e2fe8b3d-da31-4a20-92ab-ab6e3839300e`
- `{image_guid}` is random per image, so the URL cannot be built from the material value
- The signature is bound to the exact blob; without it the CDN answers `409 PublicAccessNotPermitted`
- The signatures in this document are valid until 2026-10-19; after that the thumbnails stop showing until `hi-plan-context.json` and this document are regenerated

The generation process is described in [hi-furniture-smith-materials.md](../../.agents/skills/hi-furniture-smith-materials.md).

## Color Extraction

The "Suggested Color" column contains hex color codes **calculated by analyzing actual image pixels**. This is NOT guessed from material names - each color is calculated by:

1. Downloading the thumbnail image from the URL
2. Resizing to 100x100px (maintains color distribution)
3. Sampling pixels across the image
4. Quantizing colors by grouping similar RGB values
5. Finding the most frequent color

This method provides **accurate** color representation for all materials, whether they are uniform colors or textured surfaces (wood, marble, stone, etc.).

The color extraction script uses Node.js with the Sharp library for image processing.

## Materials

| Name | Value | Thumbnail | Description | Suggested Color |
|---|---|---|---|---|
| Cloudy blue | 152 | ![Cloudy blue](https://tecconfig-preview.homag.cloud/cdn/e2fe8b3d-da31-4a20-92ab-ab6e3839300e/library/furniture_smith/images/2e191664-7565-4cc0-816a-b6434ac77bfc_152_cloudyblue.jpg?sv=2023-11-03&st=2026-09-16T00%3A00%3A00Z&se=2026-10-19T00%3A00%3A00Z&sr=b&sp=r&sig=BIc4%2FbdWI4BVvj9dh7nmotl1uIOEsmPrB0PxeuAFV%2BU%3D) | Cloudy blue | <span style="display:inline-block;width:20px;height:20px;background-color:#506080;border:1px solid #ccc;"></span> #506080 |
| Denim blue | 155 | ![Denim blue](https://tecconfig-preview.homag.cloud/cdn/e2fe8b3d-da31-4a20-92ab-ab6e3839300e/library/furniture_smith/images/95be214a-b5da-4a99-96cd-e243306eb1df_155_denimblue.jpg?sv=2023-11-03&st=2026-09-16T00%3A00%3A00Z&se=2026-10-19T00%3A00%3A00Z&sr=b&sp=r&sig=SZogu9HKYAQJPVyqURMP5zR%2FsMX4ZR48HRwYa0qrxI8%3D) | Denim blue | <span style="display:inline-block;width:20px;height:20px;background-color:#102040;border:1px solid #ccc;"></span> #102040 |
| Olive green | 160 | ![Olive green](https://tecconfig-preview.homag.cloud/cdn/e2fe8b3d-da31-4a20-92ab-ab6e3839300e/library/furniture_smith/images/0b2fee39-fe74-4e44-a611-3b19028c4456_160_olivegreen.jpg?sv=2023-11-03&st=2026-09-16T00%3A00%3A00Z&se=2026-10-19T00%3A00%3A00Z&sr=b&sp=r&sig=HE3Cxs1zIAmXDFjCzoIuH2QN8QIs9Pc0iDEl01D6uGU%3D) | Olive green | <span style="display:inline-block;width:20px;height:20px;background-color:#909060;border:1px solid #ccc;"></span> #909060 |
| Seaweed green | 165 | ![Seaweed green](https://tecconfig-preview.homag.cloud/cdn/e2fe8b3d-da31-4a20-92ab-ab6e3839300e/library/furniture_smith/images/65dea5e4-1d5b-4ff1-b200-001aaf4b11c8_165_seaweedgreen.jpg?sv=2023-11-03&st=2026-09-16T00%3A00%3A00Z&se=2026-10-19T00%3A00%3A00Z&sr=b&sp=r&sig=ypOPBuFFMwwSznQVag7FW8uY38RQv7bTNg8dubnqXAQ%3D) | Seaweed green | <span style="display:inline-block;width:20px;height:20px;background-color:#606040;border:1px solid #ccc;"></span> #606040 |
| Light grey | 178 | ![Light grey](https://tecconfig-preview.homag.cloud/cdn/e2fe8b3d-da31-4a20-92ab-ab6e3839300e/library/furniture_smith/images/d269866c-12c5-46a2-b235-e95d236788a8_178_lightgrey.jpg?sv=2023-11-03&st=2026-09-16T00%3A00%3A00Z&se=2026-10-19T00%3A00%3A00Z&sr=b&sp=r&sig=9Ndm%2FGNiADR6ReV4DuNJreSUj%2B%2B4v7DV4uGNuYS9JEE%3D) | Light grey | <span style="display:inline-block;width:20px;height:20px;background-color:#D0C0C0;border:1px solid #ccc;"></span> #D0C0C0 |
| Sunny white | 190 | ![Sunny white](https://tecconfig-preview.homag.cloud/cdn/e2fe8b3d-da31-4a20-92ab-ab6e3839300e/library/furniture_smith/images/ddd3a858-6e44-4e9d-9635-33ee7185436d_190_sunnywhite.jpg?sv=2023-11-03&st=2026-09-16T00%3A00%3A00Z&se=2026-10-19T00%3A00%3A00Z&sr=b&sp=r&sig=%2B7Tj6oSbqJKGSZmJBKvpE8NvMrdZqjlgR5JcC9MEmCY%3D) | Sunny white | <span style="display:inline-block;width:20px;height:20px;background-color:#F0F0E0;border:1px solid #ccc;"></span> #F0F0E0 |
| Snow white | 192 | ![Snow white](https://tecconfig-preview.homag.cloud/cdn/e2fe8b3d-da31-4a20-92ab-ab6e3839300e/library/furniture_smith/images/7b243b9d-d62a-48ad-b2f2-ce7e7e87e210_192_snowwhite.png?sv=2023-11-03&st=2026-09-16T00%3A00%3A00Z&se=2026-10-19T00%3A00%3A00Z&sr=b&sp=r&sig=D3aAojWMXn%2FE%2FHLHbD8zCo3%2Fg2rkDLVokc7WMHoLIXg%3D) | Snow white | <span style="display:inline-block;width:20px;height:20px;background-color:#F0F0F0;border:1px solid #ccc;"></span> #F0F0F0 |
| Jet black | 199 | ![Jet black](https://tecconfig-preview.homag.cloud/cdn/e2fe8b3d-da31-4a20-92ab-ab6e3839300e/library/furniture_smith/images/69b7fcdc-78b9-4f9d-bc7a-264013765fe8_199_jetblack.jpg?sv=2023-11-03&st=2026-09-16T00%3A00%3A00Z&se=2026-10-19T00%3A00%3A00Z&sr=b&sp=r&sig=0HgZ6zIe83ZdF%2FwIlwe1Bof9%2B%2Bx9BoZ5gS4mI%2Be04EU%3D) | Jet black | <span style="display:inline-block;width:20px;height:20px;background-color:#000000;border:1px solid #ccc;"></span> #000000 |
| Dark walnut | 214 | ![Dark walnut](https://tecconfig-preview.homag.cloud/cdn/e2fe8b3d-da31-4a20-92ab-ab6e3839300e/library/furniture_smith/images/b4155919-02e9-4311-a716-9c3763de82a5_214_darkwalnut.jpg?sv=2023-11-03&st=2026-09-16T00%3A00%3A00Z&se=2026-10-19T00%3A00%3A00Z&sr=b&sp=r&sig=cN5S9hQ2wYl5nHtufDImV13CnJYysU2a55FD0F6Xips%3D) | Dark walnut | <span style="display:inline-block;width:20px;height:20px;background-color:#906040;border:1px solid #ccc;"></span> #906040 |
| Walnut | 215 | ![Walnut](https://tecconfig-preview.homag.cloud/cdn/e2fe8b3d-da31-4a20-92ab-ab6e3839300e/library/furniture_smith/images/c7d39e55-1243-40dc-b457-1eca24e5e900_215_walnut.jpg?sv=2023-11-03&st=2026-09-16T00%3A00%3A00Z&se=2026-10-19T00%3A00%3A00Z&sr=b&sp=r&sig=qtv9zkIAMlRcQ7vdURtcuAVt87iMk%2Fzy3ORsG0lccXs%3D) | Walnut | <span style="display:inline-block;width:20px;height:20px;background-color:#C09070;border:1px solid #ccc;"></span> #C09070 |
| Tiepolo walnut | 216 | ![Tiepolo walnut](https://tecconfig-preview.homag.cloud/cdn/e2fe8b3d-da31-4a20-92ab-ab6e3839300e/library/furniture_smith/images/be725a02-480d-48af-bdd5-3d2012fbadee_216_tiepolowalnut.png?sv=2023-11-03&st=2026-09-16T00%3A00%3A00Z&se=2026-10-19T00%3A00%3A00Z&sr=b&sp=r&sig=ykZtvVZdOGEiguJIxnPEY8lDKrrMDZYn%2BRniVtpQ1QY%3D) | Tiepolo walnut | <span style="display:inline-block;width:20px;height:20px;background-color:#705040;border:1px solid #ccc;"></span> #705040 |
| Oak | 222 | ![Oak](https://tecconfig-preview.homag.cloud/cdn/e2fe8b3d-da31-4a20-92ab-ab6e3839300e/library/furniture_smith/images/48ab9bb9-9900-4d1d-9b72-b8e7f1d264af_222_oak.jpg?sv=2023-11-03&st=2026-09-16T00%3A00%3A00Z&se=2026-10-19T00%3A00%3A00Z&sr=b&sp=r&sig=P7shK7bUeV9YKiTcJt4XaXs%2BIHxOoXX25dNLOYRsHFM%3D) | Oak | <span style="display:inline-block;width:20px;height:20px;background-color:#704020;border:1px solid #ccc;"></span> #704020 |
| Bijoux oak | 224 | ![Bijoux oak](https://tecconfig-preview.homag.cloud/cdn/e2fe8b3d-da31-4a20-92ab-ab6e3839300e/library/furniture_smith/images/46630fcd-3a15-44e0-a145-397eb6011d07_224_bijouxoak.png?sv=2023-11-03&st=2026-09-16T00%3A00%3A00Z&se=2026-10-19T00%3A00%3A00Z&sr=b&sp=r&sig=an3XZ38kafOk0rTyCL7pXPxzvMTiihn%2FsZ23kcbDwK8%3D) | Bijoux oak | <span style="display:inline-block;width:20px;height:20px;background-color:#806050;border:1px solid #ccc;"></span> #806050 |
| Dark oak | 229 | ![Dark oak](https://tecconfig-preview.homag.cloud/cdn/e2fe8b3d-da31-4a20-92ab-ab6e3839300e/library/furniture_smith/images/ba318992-29e8-431e-805b-5fba7d650e92_229_darkoak.jpg?sv=2023-11-03&st=2026-09-16T00%3A00%3A00Z&se=2026-10-19T00%3A00%3A00Z&sr=b&sp=r&sig=U47UCLEkwcVLrsl78ESjOjJWlP2bA83GGUN6nfrHP1Q%3D) | Dark oak | <span style="display:inline-block;width:20px;height:20px;background-color:#101010;border:1px solid #ccc;"></span> #101010 |
| Maple | 230 | ![Maple](https://tecconfig-preview.homag.cloud/cdn/e2fe8b3d-da31-4a20-92ab-ab6e3839300e/library/furniture_smith/images/394c5d09-695d-4165-87a5-f4904679ac7c_230_maple.jpg?sv=2023-11-03&st=2026-09-16T00%3A00%3A00Z&se=2026-10-19T00%3A00%3A00Z&sr=b&sp=r&sig=7SA3vuH74Zr1qrjCmG1PKH7%2BPEglkuaGe%2FYoxH5I7oY%3D) | Maple | <span style="display:inline-block;width:20px;height:20px;background-color:#E0D0C0;border:1px solid #ccc;"></span> #E0D0C0 |
| Ash grey | 240 | ![Ash grey](https://tecconfig-preview.homag.cloud/cdn/e2fe8b3d-da31-4a20-92ab-ab6e3839300e/library/furniture_smith/images/22a6c7fb-8b9e-446b-8d3d-dc6dacf7bdaf_240_ashgrey.jpg?sv=2023-11-03&st=2026-09-16T00%3A00%3A00Z&se=2026-10-19T00%3A00%3A00Z&sr=b&sp=r&sig=%2BM%2BomUuMe1ctCBH8XGKPJZ6Un%2BMga52kanr8Ani9PKI%3D) | Ash grey | <span style="display:inline-block;width:20px;height:20px;background-color:#303030;border:1px solid #ccc;"></span> #303030 |
| Ponderosa pine | 250 | ![Ponderosa pine](https://tecconfig-preview.homag.cloud/cdn/e2fe8b3d-da31-4a20-92ab-ab6e3839300e/library/furniture_smith/images/bc10598f-88f5-46a7-a669-cef9bf4d4c7c_250_ponderosapine.png?sv=2023-11-03&st=2026-09-16T00%3A00%3A00Z&se=2026-10-19T00%3A00%3A00Z&sr=b&sp=r&sig=90gGURhjgUOgKgK2kWntZQ808wsaxcX9G0F8oGJikbk%3D) | Ponderosa pine | <span style="display:inline-block;width:20px;height:20px;background-color:#909080;border:1px solid #ccc;"></span> #909080 |
| Concrete | 316 | ![Concrete](https://tecconfig-preview.homag.cloud/cdn/e2fe8b3d-da31-4a20-92ab-ab6e3839300e/library/furniture_smith/images/3e219bf4-0d63-4eb1-86c4-96a9e69c052b_316_concrete.jpg?sv=2023-11-03&st=2026-09-16T00%3A00%3A00Z&se=2026-10-19T00%3A00%3A00Z&sr=b&sp=r&sig=IbIADBpvLk4WFmAcOyBh8T6boUC6tcdxcmIlxPovaFI%3D) | Concrete | <span style="display:inline-block;width:20px;height:20px;background-color:#808080;border:1px solid #ccc;"></span> #808080 |
| Dark marble | 324 | ![Dark marble](https://tecconfig-preview.homag.cloud/cdn/e2fe8b3d-da31-4a20-92ab-ab6e3839300e/library/furniture_smith/images/1dda7754-ab5d-47d7-b65d-cd12151cdf83_324_darkmarble.jpg?sv=2023-11-03&st=2026-09-16T00%3A00%3A00Z&se=2026-10-19T00%3A00%3A00Z&sr=b&sp=r&sig=sBJJByTDP5bffBXwiodK3%2Fz1zQ4YZpuZ79F8%2FMBJU28%3D) | Dark marble | <span style="display:inline-block;width:20px;height:20px;background-color:#404040;border:1px solid #ccc;"></span> #404040 |
| Slate | 326 | ![Slate](https://tecconfig-preview.homag.cloud/cdn/e2fe8b3d-da31-4a20-92ab-ab6e3839300e/library/furniture_smith/images/180cf5df-60d8-4179-bd00-fafd65ee74ef_326_slate.jpg?sv=2023-11-03&st=2026-09-16T00%3A00%3A00Z&se=2026-10-19T00%3A00%3A00Z&sr=b&sp=r&sig=FHUUW2Fla5OVPGtPBvebnGB1ZEGZoTPPWeUmPHQ6B0M%3D) | Slate | <span style="display:inline-block;width:20px;height:20px;background-color:#303030;border:1px solid #ccc;"></span> #303030 |
| Marble | 380 | ![Marble](https://tecconfig-preview.homag.cloud/cdn/e2fe8b3d-da31-4a20-92ab-ab6e3839300e/library/furniture_smith/images/8e8d3d28-af0c-4c02-b657-f7706c39be2f_380_marble.jpg?sv=2023-11-03&st=2026-09-16T00%3A00%3A00Z&se=2026-10-19T00%3A00%3A00Z&sr=b&sp=r&sig=92Z1ef3IfsxyblTgx0Zw74do422jt0Z3KVe2tHNVncc%3D) | Marble | <span style="display:inline-block;width:20px;height:20px;background-color:#E0E0E0;border:1px solid #ccc;"></span> #E0E0E0 |
