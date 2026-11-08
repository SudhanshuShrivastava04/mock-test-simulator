import type { Metadata } from "next";
import { Suspense } from "react";
import { Users } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { allAttempts, listStudents, listSubmissions } from "@/lib/data";
import { AppMain, Empty, ListSkeleton, PageHeader, fmtDate } from "@/components/shared";
import { AddStudentsForm, RemoveStudent } from "@/components/admin/student-controls";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata: Metadata = { title: "Students" };

export default function StudentsPage() {
  return (
    <AppMain>
      <PageHeader title="Students" description="Only these Google accounts (plus admins) can sign in." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Suspense fallback={<ListSkeleton />}>
          <List />
        </Suspense>
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Add students</CardTitle>
            <CardDescription>Inviting someone to an assessment adds them here automatically.</CardDescription>
          </CardHeader>
          <CardContent><AddStudentsForm /></CardContent>
        </Card>
      </div>
    </AppMain>
  );
}

async function List() {
  await requireAdmin();
  const [students, attempts, subs] = await Promise.all([listStudents(), allAttempts(), listSubmissions()]);
  if (!students.length) return <Empty icon={Users} title="No students yet">Add a Gmail address to let them sign in.</Empty>;
  return (
    <Card className="min-w-0">
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead className="text-right">Invites</TableHead>
              <TableHead className="text-right">Submissions</TableHead>
              <TableHead>Last sign-in</TableHead>
              <TableHead><span className="sr-only">Remove</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((s) => (
              <TableRow key={s.email}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8">
                      {s.image && <AvatarImage src={s.image} alt="" />}
                      <AvatarFallback>{(s.name || s.email).slice(0, 1).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="font-medium">{s.name || s.email.split("@")[0]}</div>
                      <div className="truncate text-xs text-muted-foreground">{s.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{attempts.filter((t) => t.email === s.email).length}</TableCell>
                <TableCell className="text-right tabular-nums">{subs.filter((x) => x.email === s.email).length}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{s.lastLoginAt ? fmtDate(s.lastLoginAt) : "Never"}</TableCell>
                <TableCell className="text-right"><RemoveStudent email={s.email} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
