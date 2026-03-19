import { blogPosts, type BlogPost } from "../blog-posts";

// Italian blog feed currently uses the canonical post bodies.
// This keeps all blog routes fully available in Italian locale.
export const itBlogs: BlogPost[] = blogPosts;
