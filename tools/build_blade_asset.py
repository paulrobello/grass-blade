#!/usr/bin/env python3
"""Build the first browser-runtime cutter GLB for Grass Blade.

Run with:
  /Applications/Blender.app/Contents/MacOS/Blender --factory-startup --background --python tools/build_blade_asset.py
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy


REPO_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = REPO_ROOT / "public" / "assets" / "blades" / "cutter-v1.glb"
PREFIX = "GB_"


def remove_prior_objects() -> None:
    for obj in list(bpy.data.objects):
        if obj.name.startswith(PREFIX):
            bpy.data.objects.remove(obj, do_unlink=True)
    for collection in list(bpy.data.collections):
        if collection.name.startswith(PREFIX):
            bpy.data.collections.remove(collection)


def material(name: str, color: tuple[float, float, float, float], metallic: float, roughness: float) -> bpy.types.Material:
    mat = bpy.data.materials.new(f"{PREFIX}{name}")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf is not None:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Roughness"].default_value = roughness
    return mat


def make_empty(name: str) -> bpy.types.Object:
    empty = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(empty)
    return empty


def add_cylinder(
    name: str,
    parent: bpy.types.Object,
    radius: float,
    depth: float,
    z: float,
    mat: bpy.types.Material,
    vertices: int = 32,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=(0, 0, z))
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}_Mesh"
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def make_curved_blade_mesh(name: str, angle: float, mat: bpy.types.Material) -> bpy.types.Object:
    root_radius = 0.4
    tip_radius = 2.12
    half_width_root = 0.15
    half_width_mid = 0.26
    half_width_tip = 0.08
    thickness = 0.045

    profile = [
        (root_radius, -half_width_root),
        (1.1, -half_width_mid),
        (tip_radius, -half_width_tip),
        (tip_radius, half_width_tip),
        (1.1, half_width_mid),
        (root_radius, half_width_root),
    ]
    verts: list[tuple[float, float, float]] = []
    for z in (-thickness / 2, thickness / 2):
        for radius, side in profile:
            verts.append((radius, side, z))

    face_count = len(profile)
    faces: list[tuple[int, ...]] = [tuple(range(face_count - 1, -1, -1)), tuple(range(face_count, face_count * 2))]
    for index in range(face_count):
        next_index = (index + 1) % face_count
        faces.append((index, next_index, next_index + face_count, index + face_count))

    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.rotation_euler[2] = angle
    obj.data.materials.append(mat)
    return obj


def add_curved_blades(parent: bpy.types.Object, count: int, blade_mat: bpy.types.Material) -> None:
    for index in range(count):
        blade = make_curved_blade_mesh(
            f"{parent.name}_Blade_{index + 1:02d}",
            (index / count) * math.tau,
            blade_mat,
        )
        blade.parent = parent


def add_saw(parent: bpy.types.Object, blade_mat: bpy.types.Material, ring_mat: bpy.types.Material) -> None:
    add_cylinder("GB_Saw_Ring", parent, 1.23, 0.12, 0, ring_mat, vertices=48)
    tooth_profile = [(1.08, -0.1), (2.08, 0), (1.08, 0.1)]
    for index in range(18):
        angle = (index / 18) * math.tau
        mesh = bpy.data.meshes.new(f"GB_Saw_Tooth_{index + 1:02d}_Mesh")
        verts = [(radius, side, z) for z in (-0.04, 0.04) for radius, side in tooth_profile]
        faces = [(2, 1, 0), (3, 4, 5), (0, 1, 4, 3), (1, 2, 5, 4), (2, 0, 3, 5)]
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(f"GB_Saw_Tooth_{index + 1:02d}", mesh)
        bpy.context.collection.objects.link(obj)
        obj.rotation_euler[2] = angle
        obj.data.materials.append(blade_mat)
        obj.parent = parent


def make_orientation_stripe_mesh(name: str, mat: bpy.types.Material) -> bpy.types.Object:
    inner_radius = 0.78
    outer_radius = 1.48
    half_width = 0.055
    bottom_z = 0.052
    top_z = 0.082
    profile = [
        (inner_radius, -half_width),
        (outer_radius, -half_width),
        (outer_radius, half_width),
        (inner_radius, half_width),
    ]

    verts: list[tuple[float, float, float]] = []
    for z in (bottom_z, top_z):
        for radius, side in profile:
            verts.append((radius, side, z))

    faces = [
        (3, 2, 1, 0),
        (4, 5, 6, 7),
        (0, 1, 5, 4),
        (1, 2, 6, 5),
        (2, 3, 7, 6),
        (3, 0, 4, 7),
    ]
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def add_orientation_stripe(parent: bpy.types.Object, name: str, mat: bpy.types.Material) -> None:
    stripe = make_orientation_stripe_mesh(name, mat)
    stripe.parent = parent


def build_asset() -> None:
    remove_prior_objects()
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0

    hub_mat = material("Hub_Cyan", (0.05, 0.62, 0.86, 1), 0.45, 0.25)
    cap_mat = material("Hub_Cap", (0.82, 0.97, 1.0, 1), 0.55, 0.22)
    blade_mat = material("Blade_Silver", (0.9, 0.94, 0.96, 1), 0.9, 0.16)
    ring_mat = material("Saw_Cyan", (0.25, 0.78, 1.0, 1), 0.75, 0.2)
    cue_mat = material("Orientation_Cyan", (0.68, 0.96, 1.0, 1), 0.55, 0.2)

    hub = make_empty("GB_Hub_STATIC")
    add_cylinder("GB_Hub_Base", hub, 0.82, 0.42, 1.02, hub_mat, vertices=32)
    add_cylinder("GB_Hub_Outer_Ring", hub, 0.78, 0.2, 1.31, hub_mat, vertices=36)
    add_cylinder("GB_Hub_Inner_Ring", hub, 0.54, 0.23, 1.36, cap_mat, vertices=32)
    add_cylinder("GB_Hub_Cap", hub, 0.32, 0.28, 1.48, hub_mat, vertices=28)

    two_arm = make_empty("GB_TwoArm_ROTATING")
    add_curved_blades(two_arm, 2, blade_mat)
    add_orientation_stripe(two_arm, "GB_TwoArm_Orientation_Stripe", cue_mat)

    four_arm = make_empty("GB_FourArm_ROTATING")
    add_curved_blades(four_arm, 4, blade_mat)
    add_orientation_stripe(four_arm, "GB_FourArm_Orientation_Stripe", cue_mat)

    saw = make_empty("GB_Saw_ROTATING")
    add_saw(saw, blade_mat, ring_mat)
    add_orientation_stripe(saw, "GB_Saw_Orientation_Stripe", cue_mat)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.data.objects:
        if obj.name.startswith(PREFIX):
            obj.select_set(True)
    for obj in (hub, two_arm, four_arm, saw):
        obj.select_set(True)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT_PATH),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
    )
    print(f"exported {OUTPUT_PATH}")


if __name__ == "__main__":
    build_asset()
