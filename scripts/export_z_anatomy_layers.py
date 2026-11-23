"""
scripts/export_z_anatomy_layers.py

Exports optimized, Draco-compressed GLB anatomical overlay layers from the official
Z-Anatomy Startup.blend file, aligned 1:1 with public/models/body.glb.

Layers exported:
  - ligaments : Joints, ligaments, articular capsules, discs, menisci, labra
  - arteries  : Systemic & pulmonary arteries, aorta, arterial branches
  - veins     : Systemic & pulmonary veins, dural venous sinuses
  - nerves    : Brain, spinal cord, cranial & peripheral nerves, plexuses, sense organs
  - organs    : Heart, lungs, bronchi, trachea, GI tract, liver, pancreas, kidneys, glands, spleen, thymus
  - skin      : Regions of human body (outer single-shell surface, clean for transparency)

Outputs:
  public/models/layers/<region>/<layer>.glb
  public/models/layers/manifest.json

Usage:
  blender -b /path/to/Startup.blend --python scripts/export_z_anatomy_layers.py -- --out public/models/layers --body public/models/body.glb
"""

import bpy
import bmesh
import json
import math
import os
import re
import struct
import sys
import mathutils


def parse_args():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    else:
        argv = []
    out_dir = "public/models/layers"
    body_glb = "public/models/body.glb"
    i = 0
    while i < len(argv):
        if argv[i] == "--out" and i + 1 < len(argv):
            out_dir = argv[i + 1]
            i += 2
        elif argv[i] == "--body" and i + 1 < len(argv):
            body_glb = argv[i + 1]
            i += 2
        else:
            i += 1
    return os.path.abspath(out_dir), os.path.abspath(body_glb)


def load_body_glb_names(body_glb_path):
    names = set()
    if not os.path.exists(body_glb_path):
        return names
    with open(body_glb_path, "rb") as f:
        f.read(12)
        c0_len, _ = struct.unpack("<I4s", f.read(8))
        gltf = json.loads(f.read(c0_len).decode("utf-8"))
    for n in gltf.get("nodes", []):
        if "mesh" not in n:
            continue
        raw = n.get("name", "")
        base = re.sub(r"\.\d{3}$", "", raw).strip().lower()
        names.add(base)
    return names


def is_junk_object(obj):
    if obj.type not in ("MESH", "CURVE"):
        return True
    nm = obj.name
    if nm.endswith((".j", ".g", ".t", "-line", ".e")):
        return True
    if "-profile" in nm.lower() or "-curve" in nm.lower() or "cross-section" in nm.lower() or "plane" in nm.lower():
        return True
    if obj.type == "MESH" and len(obj.data.polygons) == 0:
        return True
    if obj.type == "CURVE" and len(obj.data.splines) == 0:
        return True
    # Check material is only Text
    mats = [m.name.lower() for m in obj.data.materials if m]
    if mats and all(m == "text" for m in mats):
        return True
    return False


def get_primary_material_name(obj):
    if hasattr(obj.data, "materials") and obj.data.materials:
        for m in obj.data.materials:
            if m:
                return m.name.lower()
    return ""


def get_gltf_bounds_and_center(obj):
    corners = [obj.matrix_world @ mathutils.Vector(c) for c in obj.bound_box]
    # Blender Z-up (x, y, z) -> glTF Y-up (x, z, -y)
    pts = [(v.x, v.z, -v.y) for v in corners]
    mn = [min(p[i] for p in pts) for i in range(3)]
    mx = [max(p[i] for p in pts) for i in range(3)]
    center = [(mn[i] + mx[i]) * 0.5 for i in range(3)]
    return mn, mx, center


def classify_region(obj, layer_name, mn, mx, center):
    """
    Partition into 6 regions matching scripts/extract_regional_models.mjs:
    +X = anatomical LEFT, -X = anatomical RIGHT, +Y = superior.
    """
    low = obj.name.lower()
    x, y, _z = center

    # Organs live in head_neck (salivary/tongue/thyroid/pharynx/uvula/larynx) or torso (thorax/abdomen/pelvis)
    if layer_name == "organs":
        if (
            y >= 1.40
            or re.search(
                r"parotid|sublingual|submandibular|tongue|uvula|gingiva|palate|pharyn|laryn|thyroid|parathyroid|tonsil|hypophys|pituitary|pineal|lacrimal|nasal",
                low,
            )
        ):
            return "head_neck"
        return "torso"

    # Explicit Head & Neck
    if re.search(
        r"crani|skull|cerebr|cerebell|brain|pons|medulla oblongata|midbrain|thalam|hypothalam|hippocamp|amygdal|ventricle of|corpus callosum|fornix|insula|frontal lobe|parietal lobe|occipital lobe|temporal lobe|sulcus|gyrus|falx|tentorium|dura|optic|oculomotor|trochlear|trigeminal|abducen|facial nerve|vestibulocochlear|glossopharyn|hypoglossal|olfactory|ophthalmic|maxillary|mandibular|ciliary|cornea|sclera|retina|\biris\b|\blens\b|cochlea|tympanic|conjunctiv|temporomandibular|stylomandibular|stylohyoid|sphenomandibular|pterygospinous|atlanto|alare|transverse ligament of atlas|apical ligament|nuchal|cervical|carotid|jugular|vertebral (artery|vein)|basilar|cerebral|meningeal|cavernous sinus|sagittal sinus|transverse sinus|sigmoid sinus|petrosal|scalp|epicrani|eyebrow|eyelid|orbital|infraorbital|zygomatic|buccal|parotideomasseteric|mental region|oral region|nasal region|auricular|mastoid|occipital region|parietal region|temporal region|frontal region|neck|sternocleidomastoid region|supraclavicular|submandibular|submental",
        low,
    ) and not re.search(
        r"brachial|\baxillary\b|subclavian|thoracic|lumbar|sacral|femoral|gluteal|popliteal|tibial|fibular|radial|ulnar|median nerve|sciatic|pectoral|spinal dura|spinothalamic|spinocerebellar",
        low,
    ):
        return "head_neck"

    # Explicit Upper Limb
    is_upper = bool(
        re.search(
            r"shoulder|glenohumeral|acromioclavicular|coracoacromial|coracoclavicular|coracohumeral|transverse humeral|sternoclavicular|interclavicular|costoclavicular|humer|elbow|radioulnar|annular ligament|radial collateral|ulnar collateral|interosseous membrane of forearm|wrist|radiocarpal|ulnocarpal|ulnopisiform|ulnotriquetral|ulnocapitate|radiocapitate|intercarpal|carpometacarpal|metacarpophalangeal|metacarpal|carpal|scapho|lunat|triquetr|pisiform|pisohamate|pisometacarpal|pisotriquetral|capitohamate|trapezi|interphalangeal.*hand|palmar|dorsal carpal|flexor retinaculum|extensor retinaculum.*hand|\baxillary\b|brachial|radial (artery|vein|nerve|foveola)|ulnar (artery|vein|nerve)|median nerve|musculocutaneous|suprascapular|subscapular|circumflex humeral|thoracoacromial|cephalic vein|basilic vein|median cubital|palmar arch|digital.*hand|deltoid region|scapular region|cubital|antebrachial|carpal region|\bpalm\b|\bhand\b|finger|thumb|thenar|hypothenar|brachial plexus",
            low,
        )
    )
    if is_upper and not re.search(r"foot|pedis|toe|plantar|tarsal|metatarsal|knee|hip|ankle|femoral|tibial|fibular", low):
        if abs(x) < 0.015:
            return "torso"
        return "upper_limb_left" if x > 0 else "upper_limb_right"

    # Hand nail/perionyx skin (explicitly excluding foot)
    if re.search(r"\b(nail plate|perionyx)\b", low) and not re.search(r"foot|toe|pedis", low):
        if abs(x) > 0.18:
            return "upper_limb_left" if x > 0 else "upper_limb_right"

    # Explicit Lower Limb
    is_lower = bool(
        re.search(
            r"hip joint|iliofemoral|pubofemoral|ischiofemoral|ligament of head of femur|acetabular|femur|femoral|knee|cruciate|patellar|popliteal|meniscus|tibial collateral|fibular collateral|tibiofibular|interosseous membrane of leg|ankle|talocrural|talofibular|calcaneofibular|deltoid ligament|medial ligament of ankle|spring ligament|plantar|tarsal|metatarsal|interphalangeal.*foot|calcane|navicular|cuboid|cuneiform|sciatic|tibial (artery|vein|nerve)|fibular (artery|vein|nerve)|peroneal|sural|saphenous|gluteal|obturator|pudendal|profunda femoris|circumflex femoral|dorsalis pedis|gluteal region|thigh|crural|leg|calf|foot|heel|toe|hallux|malleol",
            low,
        )
    )
    if is_lower and not re.search(r"\bhand\b|manus|finger|thumb|carpal|metacarpal|brachial|elbow|shoulder|sacroiliac", low):
        if abs(x) < 0.015:
            return "torso"
        return "lower_limb_left" if x > 0 else "lower_limb_right"

    # Spatial fallback matching regional GLB bounds
    # NOTE: Check lateral upper limb / hanging hands (|x| > 0.21) BEFORE lower limb (y < 0.86)!
    if y >= 1.46 and abs(x) < 0.14:
        return "head_neck"
    if abs(x) > 0.21 and 0.65 <= y <= 1.54:
        return "upper_limb_left" if x > 0 else "upper_limb_right"
    if y < 0.86 and abs(x) > 0.025:
        return "lower_limb_left" if x > 0 else "lower_limb_right"

    # Bilateral check by suffix for peripheral structures
    if re.search(r"\.l$", low) and abs(x) > 0.21 and y >= 0.65:
        return "upper_limb_left"
    if re.search(r"\.r$", low) and abs(x) > 0.21 and y >= 0.65:
        return "upper_limb_right"
    if re.search(r"\.l$", low) and y < 0.90:
        return "lower_limb_left"
    if re.search(r"\.r$", low) and y < 0.90:
        return "lower_limb_right"
    if re.search(r"\.l$", low) and abs(x) > 0.16 and y >= 0.70:
        return "upper_limb_left"
    if re.search(r"\.r$", low) and abs(x) > 0.16 and y >= 0.70:
        return "upper_limb_right"

    return "torso"


def build_clean_material(layer_name):
    mat = bpy.data.materials.new(name=f"Physio_{layer_name}")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    colors = {
        "ligaments": (0.90, 0.93, 0.95, 1.0),
        "arteries": (0.86, 0.15, 0.15, 1.0),
        "veins": (0.15, 0.39, 0.92, 1.0),
        "nerves": (0.92, 0.70, 0.05, 1.0),
        "organs": (0.76, 0.38, 0.34, 1.0),
        "skin": (0.92, 0.76, 0.65, 1.0),
    }
    if bsdf:
        bsdf.inputs["Base Color"].default_value = colors.get(layer_name, (0.85, 0.85, 0.85, 1.0))
        bsdf.inputs["Roughness"].default_value = 0.45
    return mat


def convert_layer_batch(src_objs, layer_name, temp_col, shared_mat):
    """
    Fast batch conversion: creates all duplicates first, evaluates depsgraph ONCE
    for base meshes, applies Decimate modifiers to heavy meshes, evaluates depsgraph
    ONCE more, and cleans up. ~50x faster than per-object depsgraph evaluation!
    """
    dups = []
    for src_obj in src_objs:
        dup = src_obj.copy()
        dup.data = src_obj.data.copy()
        temp_col.objects.link(dup)

        wm = src_obj.matrix_world.copy()
        dup.parent = None
        dup.matrix_world = wm
        dup.hide_viewport = False
        dup.hide_render = False

        if dup.type == "CURVE":
            dup.data.resolution_u = min(dup.data.resolution_u, 3)
            dup.data.render_resolution_u = 3
            dup.data.bevel_resolution = min(dup.data.bevel_resolution, 2)
            if dup.data.bevel_depth <= 0.0 and dup.data.bevel_object is None:
                dup.data.bevel_depth = 0.0012
            for mod in list(dup.modifiers):
                if mod.type == "SUBSURF":
                    dup.modifiers.remove(mod)
        else:
            for mod in list(dup.modifiers):
                if mod.type == "SUBSURF":
                    mod.levels = 0
                    mod.render_levels = 0
                elif mod.type == "SOLIDIFY" and layer_name == "skin":
                    dup.modifiers.remove(mod)
                elif mod.type == "BOOLEAN":
                    dup.modifiers.remove(mod)

        dups.append((src_obj, dup, wm))

    # SINGLE depsgraph evaluation for the entire layer!
    depsgraph = bpy.context.evaluated_depsgraph_get()

    poly_cap = {
        "arteries": 450,
        "veins": 450,
        "nerves": 450,
        "ligaments": 500,
        "organs": 1200,
        "skin": 350,
    }.get(layer_name, 500)

    mesh_entries = []
    need_decimate = []

    for src_obj, dup, wm in dups:
        eval_obj = dup.evaluated_get(depsgraph)
        try:
            mesh_data = bpy.data.meshes.new_from_object(
                eval_obj, preserve_all_data_layers=False, depsgraph=depsgraph
            )
        except Exception:
            mesh_data = None

        old_data = dup.data
        bpy.data.objects.remove(dup, do_unlink=True)
        if old_data and old_data.users == 0:
            if isinstance(old_data, bpy.types.Curve):
                bpy.data.curves.remove(old_data)
            elif isinstance(old_data, bpy.types.Mesh):
                bpy.data.meshes.remove(old_data)

        if not mesh_data or len(mesh_data.polygons) == 0:
            if mesh_data and mesh_data.users == 0:
                bpy.data.meshes.remove(mesh_data)
            continue

        mesh_obj = bpy.data.objects.new(src_obj.name, mesh_data)
        mesh_obj.matrix_world = wm
        temp_col.objects.link(mesh_obj)

        poly_count = len(mesh_data.polygons)
        if poly_count > poly_cap:
            ratio = max(0.08, min(0.85, poly_cap / float(poly_count)))
            dec = mesh_obj.modifiers.new(name="Decimate", type="DECIMATE")
            dec.ratio = ratio
            dec.use_collapse_triangulate = True
            need_decimate.append(mesh_obj)

        mesh_entries.append((src_obj, mesh_obj))

    # SECOND single depsgraph evaluation only if any mesh needs decimation!
    if need_decimate:
        depsgraph2 = bpy.context.evaluated_depsgraph_get()
        for mesh_obj in need_decimate:
            eval2 = mesh_obj.evaluated_get(depsgraph2)
            dec_mesh = bpy.data.meshes.new_from_object(
                eval2, preserve_all_data_layers=False, depsgraph=depsgraph2
            )
            old_m = mesh_obj.data
            mesh_obj.modifiers.clear()
            mesh_obj.data = dec_mesh
            if old_m.users == 0:
                bpy.data.meshes.remove(old_m)

    results = []
    for src_obj, mesh_obj in mesh_entries:
        mesh_data = mesh_obj.data
        if len(mesh_data.polygons) == 0:
            bpy.data.objects.remove(mesh_obj, do_unlink=True)
            if mesh_data.users == 0:
                bpy.data.meshes.remove(mesh_data)
            continue

        for uv in list(mesh_data.uv_layers):
            mesh_data.uv_layers.remove(uv)
        for ca in list(mesh_data.color_attributes):
            mesh_data.color_attributes.remove(ca)

        mesh_data.polygons.foreach_set("use_smooth", [True] * len(mesh_data.polygons))
        mesh_data.materials.clear()
        mesh_data.materials.append(shared_mat)

        mesh_obj["layer"] = layer_name
        orig_mat = get_primary_material_name(src_obj)
        if orig_mat:
            mesh_obj["origMaterial"] = orig_mat
        mesh_obj["sourceName"] = src_obj.name
        if src_obj.name.endswith(".r"):
            mesh_obj["side"] = "right"
        elif src_obj.name.endswith(".l"):
            mesh_obj["side"] = "left"

        results.append((src_obj, mesh_obj))

    return results


def collect_layer_sources(body_existing_names):
    layers = {
        "ligaments": [],
        "arteries": [],
        "veins": [],
        "nerves": [],
        "organs": [],
        "skin": [],
    }

    seen_names = set()

    def add_unique(layer_key, obj):
        if is_junk_object(obj):
            return
        if obj.name in seen_names:
            return
        seen_names.add(obj.name)
        layers[layer_key].append(obj)

    # 1. Ligaments & Joint Capsules from "3: Joints" (skip costal/nasal cartilages already in body.glb)
    col_joints = bpy.data.collections.get("3: Joints")
    if col_joints:
        for obj in col_joints.all_objects:
            if is_junk_object(obj):
                continue
            base = re.sub(r"\.(r|l|\d{3})$", "", obj.name).strip().lower()
            if base in body_existing_names:
                continue
            if re.search(r"costal cartilage|nasal|alar cartilage|thyroid cartilage|cricoid|arytenoid|corniculate", base):
                continue
            add_unique("ligaments", obj)

    # 2. Arteries, Veins, and Heart from "5: Cardiovascular system"
    col_cardio = bpy.data.collections.get("5: Cardiovascular system")
    if col_cardio:
        for obj in col_cardio.all_objects:
            if is_junk_object(obj):
                continue
            mat = get_primary_material_name(obj)
            low = obj.name.lower()
            if re.search(
                r"atrium|ventricle|valve|leaflet|papillary muscle|pericard|myocard|heart|auricle|chordae",
                low,
            ):
                add_unique("organs", obj)
            elif "vein" in mat or re.search(r"\b(vein|veins|vena|venae|venous|sinus)\b", low):
                add_unique("veins", obj)
            else:
                add_unique("arteries", obj)

    # 3. Nerves & Brain / Spinal Cord / Sense Organs from "7: Nervous system & Sense organs"
    col_nerves = bpy.data.collections.get("7: Nervous system & Sense organs")
    if col_nerves:
        for obj in col_nerves.all_objects:
            if is_junk_object(obj):
                continue
            # Skip tiny internal ear ossicle / redundant choroid duplicates or pure dura artifacts if needed, keep clean CNS + PNS
            low = obj.name.lower()
            if re.search(r"choroid plexus", low):
                continue
            add_unique("nerves", obj)

    # 4. Internal Organs from "8: Visceral systems" + Spleen & Thymus from "6: Lymphoid organs"
    col_visc = bpy.data.collections.get("8: Visceral systems")
    if col_visc:
        for obj in col_visc.all_objects:
            if is_junk_object(obj):
                continue
            low = obj.name.lower()
            # Keep visceral organs (skip redundant gingiva/uvula clutter or keep clean organs)
            if re.search(r"gingiva", low):
                continue
            add_unique("organs", obj)

    col_lymph = bpy.data.collections.get("6: Lymphoid organs")
    if col_lymph:
        for obj in col_lymph.all_objects:
            if is_junk_object(obj):
                continue
            low = obj.name.lower()
            if re.search(r"spleen|thymus|tonsil|cisterna chyli|thoracic duct", low):
                add_unique("organs", obj)

    # 5. Skin / Body surface regions from "9: Regions of human body"
    col_skin = bpy.data.collections.get("9: Regions of human body")
    if col_skin:
        for obj in col_skin.all_objects:
            if is_junk_object(obj):
                continue
            add_unique("skin", obj)

    return layers


def export_objects_glb(objs, out_path):
    if not objs:
        return 0
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]

    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_extras=True,
        export_texcoords=False,
        export_normals=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_animations=False,
        export_cameras=False,
        export_lights=False,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=12,
        export_draco_normal_quantization=8,
    )
    return os.path.getsize(out_path) if os.path.exists(out_path) else 0


def main():
    out_dir, body_glb = parse_args()
    os.makedirs(out_dir, exist_ok=True)
    body_names = load_body_glb_names(body_glb)
    print(f"Loaded {len(body_names)} existing mesh base names from body.glb")

    # Hide unused heavy collections to keep depsgraph evaluation ultra-fast
    for lc in bpy.context.view_layer.layer_collection.children:
        if any(lc.name.startswith(p) for p in ("1:", "2:", "4:", "Bonus", "Reference", "Cross")):
            lc.exclude = True
        else:
            lc.exclude = False
            lc.hide_viewport = False

    layer_sources = collect_layer_sources(body_names)
    for k, v in layer_sources.items():
        print(f"Source layer '{k}': {len(v)} objects")

    manifest = {
        "version": 1,
        "source": "Z-Anatomy (CC BY-SA 4.0)",
        "layers": list(layer_sources.keys()),
        "regions": {},
    }

    regions_list = [
        "full_body",
        "head_neck",
        "torso",
        "upper_limb_left",
        "upper_limb_right",
        "lower_limb_left",
        "lower_limb_right",
    ]
    for r in regions_list:
        manifest["regions"][r] = {}

    for layer_name, src_objs in layer_sources.items():
        temp_col = bpy.data.collections.new(f"__EXPORT_{layer_name}")
        bpy.context.scene.collection.children.link(temp_col)
        shared_mat = build_clean_material(layer_name)

        converted_all = []
        by_region = {r: [] for r in regions_list if r != "full_body"}

        batch_out = convert_layer_batch(src_objs, layer_name, temp_col, shared_mat)
        for src, mobj in batch_out:
            mn, mx, center = get_gltf_bounds_and_center(mobj)
            reg = classify_region(src, layer_name, mn, mx, center)
            converted_all.append(mobj)
            by_region[reg].append(mobj)

        print(
            f"Converted layer '{layer_name}': total={len(converted_all)} | "
            + ", ".join(f"{r}={len(by_region[r])}" for r in by_region)
        )

        # Export full_body layer
        full_rel = f"/models/layers/full_body/{layer_name}.glb"
        full_path = os.path.join(out_dir, "full_body", f"{layer_name}.glb")
        fsize = export_objects_glb(converted_all, full_path)
        if fsize > 0:
            manifest["regions"]["full_body"][layer_name] = {
                "url": full_rel,
                "meshes": len(converted_all),
                "bytes": fsize,
            }

        # Export each non-empty region slice
        for reg, robjs in by_region.items():
            if not robjs:
                continue
            reg_rel = f"/models/layers/{reg}/{layer_name}.glb"
            reg_path = os.path.join(out_dir, reg, f"{layer_name}.glb")
            rsize = export_objects_glb(robjs, reg_path)
            if rsize > 0:
                manifest["regions"][reg][layer_name] = {
                    "url": reg_rel,
                    "meshes": len(robjs),
                    "bytes": rsize,
                }

        # Free temp objects and meshes to keep memory lean
        for o in list(temp_col.objects):
            md = o.data
            bpy.data.objects.remove(o, do_unlink=True)
            if md and md.users == 0:
                bpy.data.meshes.remove(md)
        bpy.data.collections.remove(temp_col)
        if shared_mat.users == 0:
            bpy.data.materials.remove(shared_mat)

    manifest_path = os.path.join(out_dir, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f"Wrote manifest to {manifest_path}")


if __name__ == "__main__":
    main()
