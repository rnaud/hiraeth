using System;
using System.Collections;
using System.Reflection;
using Hiraeth.Bridge;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.Rendering;

namespace Hiraeth.Tests
{
    // Exercise the actual native selection and Unity batching, not a second copy of the eligibility rule.
    public class BridgeStaticBatchTests
    {
        const BindingFlags Fields = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;
        static object Get(object o, string name) => o.GetType().GetField(name, Fields).GetValue(o);
        static void Set(object o, string name, object value) => o.GetType().GetField(name, Fields).SetValue(o, value);
        static object Make(string name) => Activator.CreateInstance(typeof(BridgeRenderer).GetNestedType(name, BindingFlags.NonPublic));

        [Test]
        public void SidedCopiesBatchWithoutConsumingMeshesReservedForStillLods()
        {
            var root = new GameObject("batch-regression");
            var bridge = root.AddComponent<BridgeRenderer>();
            var material = new Material(Shader.Find("Hiraeth/Surface"));
            int oldThreshold = BridgeRenderer.stillLodTris;
            var owned = new System.Collections.Generic.List<Mesh>();
            try
            {
                BridgeRenderer.stillLodTris = 3000;
                var nodes = (IDictionary)Get(bridge, "nodes");
                var meshes = (IDictionary)Get(bridge, "meshes");
                object Add(int id, bool sided, bool moved = false)
                {
                    var mesh = new Mesh { name = "original-" + id };
                    mesh.vertices = new[] { Vector3.zero, Vector3.right, Vector3.up };
                    mesh.normals = new[] { Vector3.forward, Vector3.forward, Vector3.forward };
                    var indices = new int[9000];
                    for (int i = 0; i < indices.Length; i++) indices[i] = i % 3;
                    mesh.triangles = indices; owned.Add(mesh);
                    var draw = sided ? UnityEngine.Object.Instantiate(mesh) : mesh;
                    if (sided) owned.Add(draw);
                    var go = new GameObject("mesh-" + id);
                    go.transform.SetParent(root.transform); go.transform.localPosition = Vector3.right * id * 3;
                    var filter = go.AddComponent<MeshFilter>(); filter.sharedMesh = draw;
                    var renderer = go.AddComponent<MeshRenderer>(); renderer.sharedMaterial = material;
                    renderer.shadowCastingMode = ShadowCastingMode.On; renderer.receiveShadows = true;
                    var md = Make("MeshData"); Set(md, "mesh", mesh); Set(md, "subs", new[] { indices });
                    meshes.Add(id.ToString(), md);
                    var node = Make("Node");
                    Set(node, "kind", "mesh"); Set(node, "mesh", id.ToString()); Set(node, "go", go);
                    Set(node, "mf", filter); Set(node, "r", renderer);
                    Set(node, "movedAt", moved ? Time.frameCount : Time.frameCount - 121);
                    if (sided) Set(node, "sidedMesh", draw);
                    nodes.Add(id, node); return node;
                }
                var a = Add(1, true); var b = Add(2, true);
                var lod = Add(3, false); var moving = Add(4, true, true);
                var beforeA = ((MeshFilter)Get(a, "mf")).sharedMesh.vertices;
                typeof(BridgeRenderer).GetMethod("StaticBatch", Fields).Invoke(bridge, null);
                foreach (var node in new[] { a, b })
                {
                    Assert.IsTrue((bool)Get(node, "batched"), "converted meshes cannot use StillLods, so must remain batch eligible");
                    var renderer = (MeshRenderer)Get(node, "r");
                    Assert.IsTrue(renderer.isPartOfStaticBatch, "Unity really combined the renderers");
                    Assert.AreSame(material, renderer.sharedMaterial);
                    Assert.AreEqual(ShadowCastingMode.On, renderer.shadowCastingMode);
                    Assert.IsTrue(renderer.receiveShadows);
                    Assert.AreEqual(3000, ((Mesh)Get(node, "sidedMesh")).triangles.Length / 3);
                }
                CollectionAssert.AreEqual(beforeA, ((Mesh)Get(a, "sidedMesh")).vertices, "source copy is unchanged");
                Assert.IsFalse((bool)Get(lod, "batched"), "ordinary large single-user meshes remain available to StillLods");
                Assert.IsFalse((bool)Get(moving, "batched"), "recent movers must still stay independent");
                Assert.AreEqual(2, Get(bridge, "batchedCount"));
                var oldRenderer = (MeshRenderer)Get(a, "r");
                var oldMatrix = ((GameObject)Get(a, "go")).transform.localToWorldMatrix;
                typeof(BridgeRenderer).GetMethod("Unbatch", Fields).Invoke(bridge, new[] { a });
                var ownRenderer = (MeshRenderer)Get(a, "r");
                Assert.IsFalse((bool)Get(a, "batched"));
                Assert.IsFalse(ownRenderer.isPartOfStaticBatch);
                Assert.AreSame(Get(a, "sidedMesh"), ((MeshFilter)Get(a, "mf")).sharedMesh);
                Assert.AreSame(material, ownRenderer.sharedMaterial);
                Assert.AreEqual(oldMatrix, ownRenderer.localToWorldMatrix);
                Assert.AreEqual(ShadowCastingMode.On, ownRenderer.shadowCastingMode);
                Assert.IsTrue(ownRenderer.receiveShadows);
                Assert.IsTrue(oldRenderer.forceRenderingOff);
                Assert.AreEqual(ShadowCastingMode.Off, oldRenderer.shadowCastingMode);
                Assert.AreEqual(1, Get(bridge, "batchedCount"));
            }
            finally
            {
                BridgeRenderer.stillLodTris = oldThreshold;
                // Avoid runtime deferred mesh destruction during this edit-mode fixture's explicit cleanup.
                ((IDictionary)Get(bridge, "meshes")).Clear();
                UnityEngine.Object.DestroyImmediate(root);
                foreach (var mesh in owned) if (mesh) UnityEngine.Object.DestroyImmediate(mesh);
                UnityEngine.Object.DestroyImmediate(material);
            }
        }
    }
}
